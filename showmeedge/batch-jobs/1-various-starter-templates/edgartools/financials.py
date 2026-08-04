#!/usr/bin/env python3
"""Collect Company Financials Data from Edgar Tools."""

# https://github.com/dgunning/edgartools

from edgar import *

# Identify yourself to the SEC — EDGAR requires an email with every request. No key, no signup, no rate-limit tier; set it once:
set_identity("srview9@gmail.com")

# get details
financials = Company("MSFT").get_financials()
bs = financials.balance_sheet()     # all line items
income = financials.income_statement()  # revenue, net income, EPS

print(income)