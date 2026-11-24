import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

data = pd.read_csv("tickets.csv")
X_train, X_test, y_train, y_test = train_test_split(
    data["message"], data["category"], test_size=0.2,
    stratify=data["category"], random_state=42
)
model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
    ("classifier", LogisticRegression(max_iter=1000))
])
model.fit(X_train, y_train)

if __name__ == "__main__":
    predictions = model.predict(X_test)
    print(classification_report(y_test, predictions, zero_division=0))
    print(model.predict([
        "Alguien entró a mi cuenta sin autorización"
    ]))
