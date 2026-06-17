"""
Text utilities: Russian pluralization, gender detection, message building.
Extracted from the original monolithic main.py.
"""

import re


# ── Russian pluralization ─────────────────────────────────────────

def _plural_ru(n: int, forms: tuple[str, str, str]) -> str:
    n_abs = abs(n) % 100
    n1 = n_abs % 10
    if 11 <= n_abs <= 19:
        return forms[2]
    if n1 == 1:
        return forms[0]
    if 2 <= n1 <= 4:
        return forms[1]
    return forms[2]


def format_hours_ru(n: int) -> str:
    return f"{n} " + _plural_ru(n, ("час", "часа", "часов"))


def format_days_ru(n: int) -> str:
    return f"{n} " + _plural_ru(n, ("день", "дня", "дней"))


# ── Gender detection ──────────────────────────────────────────────

_MALE_NAMES_ENDING_A = {
    "дима", "саша", "миша", "ваня", "петя", "костя", "сережа", "серёжа",
    "лёша", "леша", "гриша", "кузьма", "фома", "сева", "толя", "коля",
    "боря", "витя", "яша", "гоша", "женя", "паша", "лёва", "лева",
    "никита", "илья", "кеша", "слава", "стёпа", "степа", "андрюша",
    "вова", "лёня", "леня", "тёма", "тема",
}


def detect_gender(first_name: str) -> str:
    name = (first_name or "").strip().lower()
    if not name:
        return "male"
    if name in _MALE_NAMES_ENDING_A:
        return "male"
    if name.endswith(("а", "я")):
        return "female"
    return "male"


# ── Comment / message processing ─────────────────────────────────

def strip_name_from_comment(comment: str, first_name: str) -> str:
    if not comment or not first_name:
        return comment
    name = first_name.strip()
    if not name:
        return comment
    base = name
    variants = {base}
    if base.lower().endswith("я"):
        stem = base[:-1]
        variants.update({stem + s for s in ("я", "и", "е", "ю", "ей", "ёй")})
    elif base.lower().endswith("а"):
        stem = base[:-1]
        variants.update({stem + s for s in ("а", "ы", "е", "у", "ой", "ою")})
    pattern = r"\b(" + "|".join(re.escape(v) for v in variants) + r")\b"
    cleaned = re.sub(pattern, "", comment, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-—")
    return cleaned


def adjust_verb_gender(text: str, gender: str) -> str:
    if not text:
        return text
    if gender == "female":
        def repl(match: re.Match) -> str:
            word = match.group(0)
            if len(word) < 4:
                return word
            if word.lower().endswith("ла"):
                return word
            return word + "а"
        return re.sub(r"\b[а-яё]+л\b", repl, text, flags=re.IGNORECASE)
    return text


def build_comment_phrase(comment: str, first_name: str, gender: str) -> str:
    comment_clean = strip_name_from_comment(comment, first_name).strip(" .,;:-—")
    if not comment_clean:
        return ""
    c = comment_clean[0].lower() + comment_clean[1:]
    c_lower = c.lower()
    said_verb = "говорила" if gender == "female" else "говорил"

    if c_lower.startswith("отпишется"):
        tail = c[len("отпишется"):].strip()
        return f" Ты {said_verb}, что отпишешься {tail}".rstrip()
    if c_lower.startswith("обещал "):
        return " Ты обещал, что " + c[len("обещал "):].strip()
    if c_lower.startswith("обещала "):
        return " Ты обещала, что " + c[len("обещала "):].strip()
    if c_lower.startswith(("проверишь", "проверю", "сделаешь", "пришлешь", "отправишь", "напишешь")):
        return f" Ты {c}"
    return f" Ты {said_verb}, что {c}"


def build_fallback_message(
    first_name: str,
    title: str,
    wait_phrase: str,
    comment: str,
    contact_attempts: int,
    gender: str,
) -> str:
    comment_part = build_comment_phrase(comment, first_name, gender)
    if comment_part:
        comment_part = comment_part.rstrip(".") + "."
    if contact_attempts >= 3:
        return (
            f"{first_name}, это уже третье напоминание — задача «{title}» висит {wait_phrase} без ответа."
            + comment_part
            + " Прошу немедленно написать актуальный статус и срок завершения."
        )
    if contact_attempts == 2:
        return (
            f"{first_name}, второй раз пишу по задаче «{title}» — апдейта нет {wait_phrase}."
            + comment_part
            + " Нужен ответ сегодня: что сейчас по задаче и когда будет следующий шаг."
        )
    if contact_attempts == 1:
        return (
            f"{first_name}, я уже писал, но ответа не получил — по задаче «{title}» жду апдейт {wait_phrase}."
            + comment_part
            + " Прошу написать статус сегодня."
        )
    return (
        f"{first_name}, по задаче «{title}» жду твой апдейт {wait_phrase}."
        + comment_part
        + " Скажи, пожалуйста, какой сейчас статус и когда планируешь следующий шаг."
    )


def deduplicate_name_in_message(message: str, first_name: str) -> str:
    if not message or not first_name:
        return message
    name = first_name.strip()
    variants = {name}
    if name.lower().endswith("я"):
        stem = name[:-1]
        variants.update({stem + s for s in ("я", "и", "е", "ю", "ей", "ёй")})
    elif name.lower().endswith("а"):
        stem = name[:-1]
        variants.update({stem + s for s in ("а", "ы", "е", "у", "ой", "ою")})
    pattern = r"\b(" + "|".join(re.escape(v) for v in variants) + r")\b"
    name_re = re.compile(pattern, flags=re.IGNORECASE)
    matches = list(name_re.finditer(message))
    if len(matches) <= 1:
        return message
    result = []
    last = 0
    for i, m in enumerate(matches):
        result.append(message[last:m.start()])
        if i == 0:
            result.append(m.group(0))
        else:
            prefix = message[:m.start()].rstrip()
            if not prefix or prefix[-1] in ".!?…":
                result.append("Ты")
            else:
                result.append("ты")
        last = m.end()
    result.append(message[last:])
    return "".join(result)
