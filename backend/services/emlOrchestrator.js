/**
 * EML Orchestrator - Appelle le worker Python pour chaque nœud EML
 */

const axios = require('axios');

class EMLOrchestrator {
    constructor(workerUrl = 'http://localhost:5000' /* URL du worker Python */) {
        this.workerUrl = workerUrl;
    }

    _toComplex(value) {
        if (value && typeof value === 'object' && typeof value.re === 'number' && typeof value.im === 'number') {
            return { re: value.re, im: value.im };
        }
        if (typeof value === 'number') {
            return { re: value, im: 0 };
        }
        throw new Error(`Invalid complex value: ${JSON.stringify(value)}`);
    }

    _isAlmostReal(z, eps = 1e-12) {
        return typeof z?.im === 'number' && Math.abs(z.im) < eps;
    }

    async _callWorker(left, right) {
        try {
            const response = await axios.post(`${this.workerUrl}/eml`, {
                x: this._toComplex(left),
                y: this._toComplex(right)
            });
            const data = response && response.data ? response.data : {};
            if (data.detail) {
                throw new Error(data.detail);
            }
            if (data.error) {
                throw new Error(data.error);
            }
            if (data.result === undefined) {
                throw new Error('Invalid response from worker');
            }
            // Backward-compatible: worker may return a plain number
            if (typeof data.result === 'number') {
                return { re: data.result, im: 0 };
            }
            // Expected: { re, im }
            return this._toComplex(data.result);
        } catch (err) {
            const msg = (err.response && err.response.data && (err.response.data.detail || err.response.data.error)) || err.message;
            throw new Error(msg);
        }
    }

     /**
   * Évalue un arbre EML en appelant le worker Python
   * @param {EMLNode} node - Nœud EML à évaluer
   * @param {number|null} xValue - Valeur de la variable x
   * @returns {Promise<number>} Résultat du calcul
   */
    async evaluate(node, xValue = null) {
        const cache = new WeakMap();
        const xComplex = xValue === null ? null : this._toComplex(xValue);

        const evalNode = async (n) => {
            if (!n || typeof n !== 'object') {
                throw new Error('Invalid EML node');
            }
            if (cache.has(n)) return cache.get(n);

            // Leaf
            if (n.isLeaf) {
                if (n.value === 'x') {
                    if (xComplex === null) {
                        throw new Error('Variable x requires a value for evaluation');
                    }
                    cache.set(n, xComplex);
                    return xComplex;
                }
                if (n.value === '1') {
                    const one = { re: 1, im: 0 };
                    cache.set(n, one);
                    return one;
                }
                throw new Error(`Invalid leaf value '${n.value}' (Mode B requires only 'x' and '1')`);
            }

            // Internal: evaluate children first (sequential to avoid concurrency explosion)
            const leftResult = await evalNode(n.left);
            const rightResult = await evalNode(n.right);

            const result = await this._callWorker(leftResult, rightResult);
            cache.set(n, result);
            return result;
        };

        const z = await evalNode(node);
        // Return real number if almost real, else return complex object.
        if (this._isAlmostReal(z)) {
            return z.re;
        }
        return z;
    }

     /**
   * Évalue un arbre EML avec gestion d'erreur
   */
    async evaluateSafe(node, xValue = null) {
        try {
            const result = await this.evaluate(node, xValue);
            return { success: true, result, error: null };
        } catch (error) {
            return { success: false, result: null, error: error.message };
        }
    }
}

module.exports = { EMLOrchestrator };