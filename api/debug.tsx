export const config = {
  runtime: "edge",
};

export default async function handler() {
  return new Response(JSON.stringify({ status: "ok", message: "Edge function reachable" }), {
    headers: { "Content-Type": "application/json" },
  });
}