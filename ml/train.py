from pathlib import Path
from tempfile import TemporaryDirectory

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


TICKETS_PATH = Path(__file__).resolve().parents[1] / "tickets.csv"
MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "tickets.joblib"
CATEGORIES = {"ACCESS", "BUG", "FEATURE", "SECURITY"}
EXAMPLE = "Alguien entró a mi cuenta sin autorización"


def main():
    try:
        data = pd.read_csv(
            TICKETS_PATH, usecols=["message", "category"], dtype=str, keep_default_na=False
        )
        messages = data["message"].str.strip()
        categories = data["category"].str.strip()
        if messages.eq("").any() or set(categories) != CATEGORIES:
            raise ValueError("usa mensajes no vacíos y las cuatro categorías del contrato")

        X_train, X_test, y_train, y_test = train_test_split(
            messages, categories, test_size=0.2, stratify=categories, random_state=42
        )
        if set(y_train) != CATEGORIES or set(y_test) != CATEGORIES:
            raise ValueError("faltan ejemplos de alguna categoría en la división 80/20")
    except (OSError, ValueError) as error:
        raise SystemExit(f"No se pudo preparar tickets.csv: {error}") from None

    model = Pipeline([
        ("vectorizer", TfidfVectorizer(ngram_range=(1, 2))),
        ("classifier", LogisticRegression(max_iter=1000)),
    ])
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    print(classification_report(y_test, predictions, zero_division=0))
    print(f"Predicción del ejemplo: {model.predict([EXAMPLE])[0]}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=MODEL_PATH.parent) as temporary_dir:
        temporary_model = Path(temporary_dir) / MODEL_PATH.name
        joblib.dump(model, temporary_model)
        temporary_model.replace(MODEL_PATH)
    print(f"Modelo guardado en {MODEL_PATH}")


if __name__ == "__main__":
    main()
