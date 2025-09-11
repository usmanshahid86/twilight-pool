const ZK_KYC_URL = process.env.NEXT_PUBLIC_KYC_ENDPOINT as string;

export async function POST(request: Request) {
  try {
    // Get the request body
    const body = await request.json();

    // Forward the request to the external API
    const response = await fetch(`${ZK_KYC_URL}/api/verify/zkpass`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Get the response data
    const data = await response.text();

    console.log("data", data);

    // Return the response with the same status and headers
    return new Response(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
