/**
 * Prisma database client singleton.
 * @module db
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
