"""python -m app.seed [--demo-users]

Loads content/ into the configured database. --demo-users creates one account per
role for local development (refused when MEDVERSE_ENV=production).
"""

import argparse
import logging
import sys

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.seed.demo_users import DEMO_PASSWORD, ensure_demo_users
from app.seed.loader import ContentIntegrityError, run_seed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo-users", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    settings = get_settings()
    with SessionLocal() as db:
        try:
            report = run_seed(db, settings.content_dir)
        except ContentIntegrityError as exc:
            print(exc, file=sys.stderr)
            return 1
        for k, v in report.counts.items():
            print(f"  {k:<18} {v}")
        if args.demo_users:
            if settings.is_production:
                print("Refusing to create demo users in production", file=sys.stderr)
                return 1
            for email in ensure_demo_users(db):
                print(f"  demo user: {email} / {DEMO_PASSWORD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
