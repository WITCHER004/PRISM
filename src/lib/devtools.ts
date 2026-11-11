/** Dev role switcher and simulation buttons: on in development, or with NEXT_PUBLIC_DEV_TOOLS=true */
export const DEV_TOOLS = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEV_TOOLS === "true"
