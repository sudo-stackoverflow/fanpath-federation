import express from "express";

const FEDERATION_KEY = process.env.FEDERATION_KEY ?? "";

export function requireKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const key = (req.query.key as string) || req.headers["x-federation-key"];
  if (!FEDERATION_KEY || key !== FEDERATION_KEY) {
    return res
      .status(401)
      .send(
        "<h1 style='font-family:sans-serif;padding:40px'>401 — Invalid or missing federation key</h1>"
      );
  }
  next();
}
