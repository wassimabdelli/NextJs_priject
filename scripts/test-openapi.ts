import { z } from "zod";

const s = z.object({ a: z.string() });
console.log("s._zod:", !!(s as any)._zod);

const s2 = new (s as any).constructor((s as any)._def);
console.log("s2._zod:", !!(s2 as any)._zod);
console.log("s2:", s2);
