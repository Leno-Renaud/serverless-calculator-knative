#!/usr/bin/env python3
from flask import Flask, request, jsonify
import math
import os

app = Flask(__name__)


def eml(x, y):
    return math.exp(x) - math.log(y)


def exp_1(x):
    # exp(x) = eml(x, 1)  car ln(1) = 0
    return eml(x, 1)


def log_1(x):
    # ln(x) = e - ln(exp(e - ln(x))) = eml(1, exp_1(eml(1, x)))
    # cas limite : ln(0) = -inf → exp(-inf) = 0, utilisé par neg_1
    if x == 0:
        return float('-inf')
    return eml(1, exp_1(eml(1, x)))


def minus_1(x, y):
    # x - y = exp(ln(x)) - ln(exp(y)) = eml(ln(x), exp(y))
    # requiert x > 0 (ou x = 0 via la limite ln(0) = -inf)
    return eml(log_1(x), exp_1(y))


def neg_1(x):
    # -x = 0 - x = minus_1(ln(1) = 0, x)
    # log_1(1) = 0, minus_1(0, x) = exp(-inf) - ln(exp(x)) = 0 - x = -x
    return minus_1(log_1(1), x)


def plus_1(x, y):
    # x + y = x - (-y) = minus_1(x, neg_1(y))
    # requiert x >= 0
    return minus_1(x, neg_1(y))


# ── opérations de la calculatrice ──────────────────────────────────────────

def eml_add(a, b):
    # plus_1 requiert un premier argument >= 0 (pour log_1)
    if a >= 0:
        return plus_1(a, b)
    if b >= 0:
        return plus_1(b, a)           # commutativité : a+b = b+a
    # a < 0 et b < 0 : -(|a| + |b|)
    return neg_1(plus_1(neg_1(a), neg_1(b)))


def eml_sub(a, b):
    return eml_add(a, neg_1(b))


def eml_mul(a, b):
    if a == 0 or b == 0:
        return 0.0
    abs_a = a if a > 0 else neg_1(a)
    abs_b = b if b > 0 else neg_1(b)
    # |a| * |b| = exp(ln|a| + ln|b|) = exp_1(eml_add(log_1(|a|), log_1(|b|)))
    abs_result = exp_1(eml_add(log_1(abs_a), log_1(abs_b)))
    return abs_result if (a > 0) == (b > 0) else neg_1(abs_result)


def eml_div(a, b):
    if abs(b) < 1e-15:
        raise ZeroDivisionError('Division par zéro')
    if a == 0:
        return 0.0
    abs_a = a if a > 0 else neg_1(a)
    abs_b = b if b > 0 else neg_1(b)
    # |a| / |b| = exp(ln|a| - ln|b|) = exp_1(eml_sub(log_1(|a|), log_1(|b|)))
    abs_result = exp_1(eml_sub(log_1(abs_a), log_1(abs_b)))
    return abs_result if (a > 0) == (b > 0) else neg_1(abs_result)


# ── évaluation de l'arbre EML ──────────────────────────────────────────────

def eval_eml(node):
    if not isinstance(node, dict):
        raise ValueError('Nœud EML invalide')

    if node.get('isLeaf'):
        v = node.get('value')
        try:
            return float(v)
        except Exception:
            raise ValueError('Valeur feuille invalide')

    op = node.get('op')
    left = eval_eml(node.get('left'))
    right = eval_eml(node.get('right'))

    if op == 'add':
        return eml_add(left, right)
    if op == 'sub':
        return eml_sub(left, right)
    if op == 'mul':
        return eml_mul(left, right)
    if op == 'div':
        return eml_div(left, right)

    raise ValueError('Opérateur non supporté')


@app.route('/eml', methods=['POST'])
def calculate():
    data = request.get_json()
    if not data or 'eml' not in data:
        return jsonify({'error': 'EML manquant'}), 400

    try:
        value = eval_eml(data['eml'])
    except ZeroDivisionError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    rounded = round(value, 12)
    if rounded == -0.0:
        rounded = 0.0

    return jsonify({'result': rounded})


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 8000))
    app.run(host='0.0.0.0', port=port)
