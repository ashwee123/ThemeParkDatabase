export async function login(res, send, body) {
  const { email, password } = body;

  // hardcoded HR login
  if (email === "hr@nightmarenexus.com" && password === "hr123") {
    return send(res, 200, {
      message: "Login successful",
      role: "hr"
    });
  }

  return send(res, 401, { error: "Invalid credentials" });
}
