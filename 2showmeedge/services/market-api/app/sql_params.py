import re


MAX_SQL_PARAMS = 4
NUMERIC_SQL_LITERAL_PATTERN = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$", re.IGNORECASE)


def prepare_sql_query(sql: str, params: list[str]) -> str:
    if len(params) > MAX_SQL_PARAMS:
        raise ValueError(f"Only {MAX_SQL_PARAMS} SQL parameters are supported")

    prepared_parts: list[str] = []
    used_param_indexes: set[int] = set()
    index = 0

    while index < len(sql):
        char = sql[index]

        if char == "'":
            literal, index = _consume_single_quoted_sql(sql, index)
            prepared_parts.append(literal)
            continue

        if char == '"':
            identifier, index = _consume_double_quoted_sql(sql, index)
            prepared_parts.append(identifier)
            continue

        if char == "-" and index + 1 < len(sql) and sql[index + 1] == "-":
            comment, index = _consume_line_comment(sql, index)
            prepared_parts.append(comment)
            continue

        if char == "/" and index + 1 < len(sql) and sql[index + 1] == "*":
            comment, index = _consume_block_comment(sql, index)
            prepared_parts.append(comment)
            continue

        if char == "$" and index + 1 < len(sql) and sql[index + 1].isdigit():
            start = index + 1
            index = start
            while index < len(sql) and sql[index].isdigit():
                index += 1

            param_index = int(sql[start:index])
            if param_index < 1 or param_index > MAX_SQL_PARAMS:
                raise ValueError("Only SQL parameters $1 through $4 are supported")
            if param_index > len(params):
                raise ValueError(f"Parameter ${param_index} is required")

            used_param_indexes.add(param_index)
            prepared_parts.append(_sql_param_literal(params[param_index - 1]))
            continue

        prepared_parts.append(char)
        index += 1

    for provided_index in range(1, len(params) + 1):
        if provided_index not in used_param_indexes:
            raise ValueError(f"Parameter ${provided_index} was provided but is not referenced by the SQL query")

    return "".join(prepared_parts)


def _sql_param_literal(value: str) -> str:
    trimmed_value = value.strip()
    if "\x00" in trimmed_value:
        raise ValueError("SQL parameter values cannot contain null bytes")

    if NUMERIC_SQL_LITERAL_PATTERN.match(trimmed_value):
        return trimmed_value

    if trimmed_value.lower() == "true":
        return "true"

    if trimmed_value.lower() == "false":
        return "false"

    return "'" + trimmed_value.replace("'", "''") + "'"


def _consume_single_quoted_sql(sql: str, start: int) -> tuple[str, int]:
    index = start + 1

    while index < len(sql):
        if sql[index] == "'":
            if index + 1 < len(sql) and sql[index + 1] == "'":
                index += 2
                continue

            return sql[start : index + 1], index + 1

        index += 1

    return sql[start:], len(sql)


def _consume_double_quoted_sql(sql: str, start: int) -> tuple[str, int]:
    index = start + 1

    while index < len(sql):
        if sql[index] == '"':
            if index + 1 < len(sql) and sql[index + 1] == '"':
                index += 2
                continue

            return sql[start : index + 1], index + 1

        index += 1

    return sql[start:], len(sql)


def _consume_line_comment(sql: str, start: int) -> tuple[str, int]:
    newline_index = sql.find("\n", start)

    if newline_index == -1:
        return sql[start:], len(sql)

    return sql[start : newline_index + 1], newline_index + 1


def _consume_block_comment(sql: str, start: int) -> tuple[str, int]:
    end_index = sql.find("*/", start + 2)

    if end_index == -1:
        return sql[start:], len(sql)

    return sql[start : end_index + 2], end_index + 2
