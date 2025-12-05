import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow w-80">
        <h2 className="text-lg font-bold mb-4">GrandmaCRM</h2>
        <input
          className="border p-2 mb-3 w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border p-2 mb-3 w-full"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-red-500 text-xs mb-2">{error}</div>}

        <button className="bg-blue-600 text-white w-full py-2 rounded mb-3">
          {mode === "login" ? "登录" : "注册"}
        </button>

        <div className="text-xs text-blue-500 cursor-pointer" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
        </div>
      </form>
    </div>
  );
}
