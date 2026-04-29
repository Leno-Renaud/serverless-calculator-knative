#!/usr/bin/env python3
from flask import Flask, request, jsonify
import json
import cmath
import os

app = Flask(__name__)


def eval_eml(node):
    if not isinstance(node, dict):
        raise ValueError('Nœud EML invalide')

    if node.get('isLeaf'):
        v = node.get('value')
        try:
            return complex(float(v), 0.0)
        except Exception:
            raise ValueError('Valeur feuille invalide')

    left = eval_eml(node.get('left'))
    right = eval_eml(node.get('right'))

    if abs(right.real) < 1e-15 and abs(right.imag) < 1e-15:
        raise ZeroDivisionError('Division par zéro')

    try:
        return cmath.exp(left) - cmath.log(right)
    except Exception:
        raise ValueError('Erreur de calcul EML')


@app.get('/eml')
def calculate():
    eml_str = request.args.get('eml')
    if not eml_str:
        return jsonify({'error': 'EML manquant'}), 400

    try:
        eml = json.loads(eml_str)
    except Exception:
        return jsonify({'error': 'JSON EML invalide'}), 400

    try:
        value = eval_eml(eml)
    except ZeroDivisionError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    if abs(value.imag) >= 1e-10:
        return jsonify({'error': 'Résultat complexe inattendu'}), 400

    rounded = round(value.real, 12)
    if rounded == -0.0:
        rounded = 0.0

    return jsonify({'result': rounded})


if __name__ == '__main__':
    port = int(os.environ.get('WORKER_PORT', 8000))
    app.run(host='0.0.0.0', port=port)
