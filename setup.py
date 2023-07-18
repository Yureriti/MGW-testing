import os
import re

from collections import defaultdict
from setuptools import find_packages, setup
from typing import List

BASE = os.path.abspath(os.path.dirname(__file__))
DEPLOY_REQUIREMENTS = os.path.join(BASE, "deploy-requirements.txt")
EXTRA_REQUIREMENTS = os.path.join(BASE, "extra-requirements.txt")


def _parse_extra_requirements(lines):
    extra_deps = defaultdict(set)
    for line in lines:
        dep, tags = line.split(":")
        tags = set(t.strip() for t in tags.split(","))
        for t in tags:
            extra_deps[t].add(dep)
    extra_deps["all"] = set(vv for v in extra_deps.values() for vv in v)
    return extra_deps


def _get_requirements(fname: str) -> List[str]:
    try:
        with open(fname) as f:
            lines = [k.strip() for k in f.read().splitlines() if not k.startswith("#")]
            if "extra" in fname:
                return _parse_extra_requirements(lines)
            return lines
    except:
        raise RuntimeError(f"Could not find {fname} or it was not properly formatted")


def _get_version():
    init_py = os.path.join(BASE, "src", "webapp", "__init__.py")
    try:
        with open(init_py) as fid:
            return re.search('__version__ = "(.*)"', fid.read()).groups()[0]
    except:
        raise RuntimeError(
            f"Could not find {init_py} or found bad Version data in __init__.py"
        )


DISTNAME = "mg-web"
DESCRIPTION = "TERRRAA Maneuver Game Web App"
VERSION = _get_version()
INSTALL_REQUIRES = _get_requirements(DEPLOY_REQUIREMENTS)
EXTRAS_REQUIRES = _get_requirements(EXTRA_REQUIREMENTS)


setup(
    name=DISTNAME,
    author="TERRAA Team",
    # author_email="",
    description=DESCRIPTION,
    url="https://github.com/MITLL-TERRAA/ManeuverGameWeb",
    python_requires=">=3.7, <3.11",
    package_dir={"": "src"},
    packages=find_packages("src"),
    include_package_data=True,
    install_requires=INSTALL_REQUIRES,
    extras_require=EXTRAS_REQUIRES,
)
