#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')

    # Compatibility shim: some third-party packages (or older code) import
    # `django.utils.baseconv` which was removed in newer Django versions.
    # To avoid modifying site-packages, we inject a small compatibility
    # module into sys.modules before Django imports it.
    try:
        import sys
        if 'django.utils.baseconv' not in sys.modules:
            import types

            baseconv_mod = types.ModuleType('django.utils.baseconv')

            def int_to_base(number, base=36):
                if number == 0:
                    return '0'
                digits = '0123456789abcdefghijklmnopqrstuvwxyz'
                if base < 2 or base > len(digits):
                    raise ValueError('base must be between 2 and 36')
                sign = ''
                if number < 0:
                    sign = '-'
                    number = -number
                res = []
                while number:
                    number, rem = divmod(number, base)
                    res.append(digits[rem])
                return sign + ''.join(reversed(res))

            def int2base36(number):
                return int_to_base(int(number), 36)

            def base36_to_int(s):
                return int(str(s), 36)

            # Expose a minimal API similar to the old django.utils.baseconv
            baseconv_mod.int2base36 = int2base36
            baseconv_mod.base36_to_int = base36_to_int
            baseconv_mod.int_to_base = int_to_base
            # Put into sys.modules so `from django.utils import baseconv` works
            sys.modules['django.utils.baseconv'] = baseconv_mod
    except Exception:
        # best-effort shim; if this fails we'll let the real import attempt proceed
        pass

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
