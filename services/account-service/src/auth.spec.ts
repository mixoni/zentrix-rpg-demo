import { signJwt, verifyJwt } from "./jwt";

test("jwt roundtrip", () => {
  const token = signJwt({ sub: "u1", role: "User", username: "x" }, "s", "1h");
  const p = verifyJwt(token, "s");
  expect(p.sub).toBe("u1");
  expect(p.role).toBe("User");
});
