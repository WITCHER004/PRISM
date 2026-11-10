import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const missingDatabaseUrlMessage =
  "DATABASE_URL is not configured. Copy .env.example to .env.local and add your database connection string before using Prisma."

function createMissingPrismaClient(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get() {
      throw new Error(missingDatabaseUrlMessage)
    },
    set() {
      return true
    },
  })
}

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)

export const db = hasDatabaseUrl
  ? (globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      }))
  : createMissingPrismaClient()

if (hasDatabaseUrl && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}

if (!hasDatabaseUrl) {
  console.warn(missingDatabaseUrlMessage)
}

export default db

