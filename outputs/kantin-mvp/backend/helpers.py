"""Fungsi umum untuk respons API dan akses petugas."""
from functools import wraps

from flask import jsonify, request, session


def error(message, code=400):
    return jsonify(error=message), code


def json_object():
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else {}


def staff_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get('staff'):
            return error('Silakan masuk sebagai petugas.', 401)
        return fn(*args, **kwargs)
    return wrapped
