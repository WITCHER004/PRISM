import { ImageResponse } from "next/og"
import { createElement as h } from "react"

export function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get("title")?.slice(0, 100) || "Ideas, refracted."
  const description =
    searchParams.get("description")?.slice(0, 180) ||
    "Independent writing, read by humans."

  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#f4f3ef",
          color: "#111113",
        },
      },
      [
        h("div", { key: "top", style: { display: "flex", flexDirection: "column" } }, [
          h(
            "div",
            {
              key: "brand",
              style: {
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-1px",
              },
            },
            [
              h(
                "span",
                { key: "mark", style: { color: "#5b3df5", fontSize: 34 } },
                "P"
              ),
              "prism",
            ]
          ),
          h("div", {
            key: "rule",
            style: {
              width: "100%",
              height: 8,
              marginTop: 36,
              borderRadius: 8,
              background:
                "linear-gradient(90deg, #ed6a5a, #f3b84b, #5dbb83, #4f9bd8, #8159cf, #df6693)",
            },
          }),
        ]),
        h("div", { key: "content", style: { display: "flex", flexDirection: "column", gap: 20 } }, [
          h(
            "div",
            {
              key: "title",
              style: {
                fontSize: 64,
                lineHeight: 1.08,
                fontWeight: 700,
                letterSpacing: "-2px",
                display: "flex",
                maxHeight: 210,
                overflow: "hidden",
              },
            },
            title
          ),
          h(
            "div",
            {
              key: "description",
              style: {
                color: "#62626b",
                fontSize: 26,
                lineHeight: 1.35,
                display: "flex",
                maxHeight: 72,
                overflow: "hidden",
              },
            },
            description
          ),
        ]),
        h(
          "div",
          {
            key: "url",
            style: { display: "flex", color: "#62626b", fontSize: 20 },
          },
          "prism.pub"
        ),
      ]
    ),
    { width: 1200, height: 630 }
  )
}
