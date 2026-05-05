#!/usr/bin/env python3
from flask import Flask, request, jsonify
import math
import os
import requests

app = Flask(__name__)

global emlcounter
emlcounter = 0

def eml(x, y):
    emlcounter += 1
    response = requests.post(
        f"{EML_URL}/eml",
        headers={"Content-Type": "application/json"},
        json={"a" : x , "b" : y} 
    )
    data = response.json()
    return data["result"]


def exp_1(x):
    return eml(x, 1)


def log_1(x):
    if x == 0:
        return float('-inf')
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
    # applique fn sur les valeurs absolues, restaure le signe
    abs_a = a if a > 0 else neg_1(a)
    abs_b = b if b > 0 else neg_1(b)
    result = fn(abs_a, abs_b)
    return result if (a > 0) == (b > 0) else neg_1(result)


def _add(a, b):
    # plus_1 requiert un premier argument >= 0 (domaine de log_1)
    if a >= 0:
        return plus_1(a, b)
    if b >= 0:
        return plus_1(b, a)
    return neg_1(plus_1(neg_1(a), neg_1(b)))


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
        return _add(left, right)
    if op == 'sub':
        return _add(left, neg_1(right))
    if op == 'mul':
        return _signed(multiply_1, left, right)
    if op == 'div':
        if abs(right) < 1e-15:
            raise ZeroDivisionError('Division par zéro')
        return _signed(divide_1, left, right)

    raise ValueError('Opérateur non supporté')


@app.route('/worker', methods=['POST'])
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

    print(emlcounter)
    emlcounter = 0

    return jsonify({'result': rounded})


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 8000))
    app.run(host='0.0.0.0', port=port)
