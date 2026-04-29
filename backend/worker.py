#!/usr/bin/env python3
from flask import Flask, request, jsonify
import os

app = Flask(__name__)


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
        return left + right
    if op == 'sub':
        return left - right
    if op == 'mul':
        return left * right
    if op == 'div':
        if abs(right) < 1e-15:
            raise ZeroDivisionError('Division par zéro')
        return left / right

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
    port = int(os.environ.get('WORKER_PORT', 8000))
    app.run(host='0.0.0.0', port=port)
