#!/usr/bin/env python3
from flask import Flask, request, jsonify
import os
import requests

app = Flask(__name__)

EML_URL = os.environ.get('EML_URL', 'http://localhost:10000')

_eml_count = 0


def eml(x, y):
    global _eml_count
    _eml_count += 1
    try:
        response = requests.post(
            f"{EML_URL}/eml",
            headers={"Content-Type": "application/json"},
            json={"a": x, "b": y}
        )
        data = response.json()
        if response.ok:
            return data["result"]
        else:
            raise ValueError(data.get('error', 'Erreur EML'))
    except Exception as e:
        raise ValueError(f"Erreur lors de l'appel au service EML: {str(e)}")


def exp_1(x):
    return eml(x, 1)


def log_1(x):
    return eml(1, exp_1(eml(1, x)))


def minus_1(x, y):
    return eml(log_1(x), exp_1(y))


def neg_1(x):
    return minus_1(log_1(1), x)


def plus_1(x, y):
    return minus_1(x, neg_1(y))


def multiply_1(x, y):
    return exp_1(plus_1(log_1(x), log_1(y)))


def divide_1(x, y):
    return exp_1(minus_1(log_1(x), log_1(y)))


def _signed(fn, a, b):
    abs_a = a if a > 0 else neg_1(a)
    abs_b = b if b > 0 else neg_1(b)
    result = fn(abs_a, abs_b)
    return result if (a > 0) == (b > 0) else neg_1(result)


def _add(a, b):
    if a >= 0:
        return plus_1(a, b)
    if b >= 0:
        return plus_1(b, a)
    return neg_1(plus_1(neg_1(a), neg_1(b)))


def ast_to_eml(node):
    if not isinstance(node, dict):
        raise ValueError('Nœud AST invalide')

    if node.get('type') == 'number':
        return {
            'isLeaf': True,
            'value': float(node['value'])
        }

    if node.get('type') == 'op':
        return {
            'isLeaf': False,
            'op': node['op'],
            'left': ast_to_eml(node['left']),
            'right': ast_to_eml(node['right'])
        }

    raise ValueError('Nœud AST invalide')


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

    if op == '+':
        return _add(left, right)
    if op == '-':
        return _add(left, neg_1(right))
    if op == '*':
        return _signed(multiply_1, left, right)
    if op == '/':
        if abs(right) < 1e-15:
            raise ZeroDivisionError('Division par zéro')
        return _signed(divide_1, left, right)

    raise ValueError('Opérateur non supporté')


@app.route('/worker', methods=['POST'])
def calculate():
    global _eml_count
    _eml_count = 0

    data = request.get_json()
    if not data or 'ast' not in data:
        return jsonify({'error': 'AST manquant'}), 400

    try:
        eml_tree = ast_to_eml(data['ast'])
        value = eval_eml(eml_tree)
    except ZeroDivisionError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    rounded = round(value, 12)
    if rounded == -0.0:
        rounded = 0.0

    return jsonify({'result': rounded, 'eml_calls': _eml_count})


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 8000))
    app.run(host='0.0.0.0', port=port)
