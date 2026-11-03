"use client";
import { useEffect, useState } from "react";

type Answer = { id: number; text: string; is_correct: boolean };
type Question = { id: number; statement: string; answers: Answer[] };

export default function ExamPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/exam/start", { method: "POST", body: JSON.stringify({ path: "CSP" }) })
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions));
  }, []);

  async function submit() {
    const score = questions.filter((q) =>
      q.answers.find((a) => a.id === selected[q.id])?.is_correct
    ).length;
    const r = await fetch("/api/exam/submit", {
      method: "POST",
      body: JSON.stringify({ userId: localStorage.getItem("uid"), path: "CSP", score }),
    }).then((r) => r.json());
    setResult(r.passed ? "Bravo, vous avez réussi l'examen civique !" : "Examen échoué.");
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", fontSize: 13 }}>
      {questions.map((q, i) => (
        <div key={q.id}>
          <p>{i + 1}. {q.statement}</p>
          {q.answers.map((a) => (
            <div key={a.id} onClick={() => setSelected({ ...selected, [q.id]: a.id })}
              style={{ padding: 4, background: selected[q.id] === a.id ? "#cde" : "white" }}>
              {a.text}
            </div>
          ))}
        </div>
      ))}
      <button onClick={submit}>Valider</button>
      {result && <h2>{result}</h2>}
    </main>
  );
}
