// Turns a Next.js standalone build into an Amplify Hosting compute bundle, so CI
// can deploy over OIDC. The org disables deploy keys, which rules out a repo connection.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"

const OUT = ".amplify-hosting"
rmSync(OUT, { recursive: true, force: true })
mkdirSync(`${OUT}/compute`, { recursive: true })

cpSync(".next/standalone", `${OUT}/compute/default`, { recursive: true, verbatimSymlinks: true })
cpSync(".next/static", `${OUT}/static/_next/static`, { recursive: true })
if (existsSync("public")) cpSync("public", `${OUT}/static`, { recursive: true })

const { version } = JSON.parse(readFileSync("node_modules/next/package.json", "utf8"))

writeFileSync(
  `${OUT}/deploy-manifest.json`,
  JSON.stringify(
    {
      version: 1,
      framework: { name: "next", version },
      routes: [
        { path: "/_next/static/*", target: { kind: "Static", cacheControl: "public, max-age=31536000, immutable" } },
        { path: "/brand/*", target: { kind: "Static", cacheControl: "public, max-age=86400" } },
        { path: "/sw.js", target: { kind: "Static", cacheControl: "public, max-age=0, must-revalidate" } },
        { path: "/offline.html", target: { kind: "Static", cacheControl: "public, max-age=3600" } },
        { path: "/*", target: { kind: "Compute", src: "default" } },
      ],
      computeResources: [{ name: "default", runtime: "nodejs22.x", entrypoint: "server.js" }],
    },
    null,
    2,
  ),
)
console.log(`Packaged Next ${version} into ${OUT}`)
