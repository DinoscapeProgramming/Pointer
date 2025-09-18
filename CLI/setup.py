#!/usr/bin/env python3
"""
Pointer CLI - A professional command-line interface for AI-powered local codebase assistance.
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="pointer-cli",
    version="1.0.0",
    author="Pointer CLI Team",
    author_email="team@pointer-cli.dev",
    description="A professional command-line interface for AI-powered local codebase assistance",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/pointer-cli/pointer-cli",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Software Development :: Tools",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "pointer=pointer_cli.main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "pointer_cli": ["config/*.json", "templates/*.txt"],
    },
)
