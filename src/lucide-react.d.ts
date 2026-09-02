/**
 * Module shim for `lucide-react`.
 *
 * The package ships its (correct, complete) types at
 * `node_modules/lucide-react/dist/lucide-react.d.ts` but exposes them via the
 * legacy `typings` field, which TypeScript's `moduleResolution: "bundler"`
 * does not honour. This re-export makes those real types resolvable for every
 * importer in the app — it is a resolution fix, not a type lie.
 */
declare module "lucide-react" {
  export * from "lucide-react/dist/lucide-react";
}