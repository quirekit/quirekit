import { parseArgs } from "node:util";
import { decodeBase64url } from "../../key/codec";
import { parseOemCertificate } from "../../key/oem/codec";
import { generateQuireKitVendorKey, signQuireKitSubLicense } from "../../issue/issue";
import { logIssuance, readToken, readVendorKey, writeVendorKey } from "./files";

const usage = `Usage: quirekit-oem keygen [--dir <path>]
       quirekit-oem issue --certificate <file|token> --licensee <customer> --domains a.com,*.b.com,10.1.2.3,192.168.10.* [--dir <path>]
       quirekit-oem inspect <token>`;

/**
 * Vendor tool for QuireKit OEM licensing: creates the vendor key pair whose public half goes
 * into the certificate, and signs one sub-license per end customer under that certificate.
 * @param argv - Command-line arguments without the executable and script.
 * @returns Process exit code.
 */
export async function main(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: [...argv], allowPositionals: true, options: {
    dir: { type: "string" }, certificate: { type: "string" }, licensee: { type: "string" }, domains: { type: "string" },
    help: { type: "boolean", short: "h" }
  } });
  const [command, token] = positionals, directory = values.dir ?? ".quirekit-oem";
  try {
    if (command === "keygen") return await keygen(directory);
    if (command === "issue") return await issue(directory, values.certificate, values.licensee, values.domains);
    if (command === "inspect" && token) return inspect(await readToken(token));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  process.stderr.write(`${usage}\n`);
  return values.help ? 0 : 1;
}

/**
 * Creates the vendor key pair and prints the public key to send to QuireKit.
 * @param directory - Vendor directory receiving the private key.
 * @returns Exit code.
 */
async function keygen(directory: string): Promise<number> {
  const { privateKey, publicKey } = await generateQuireKitVendorKey();
  await writeVendorKey(directory, privateKey);
  process.stdout.write(`Private key saved in ${directory}; back it up and never share it.\nPublic key for your OEM certificate:\n${publicKey}\n`);
  return 0;
}

/**
 * Signs one offline sub-license for an end customer and records it in the local log. Offline
 * sub-licenses need an offline certificate and bound addresses; others are issued in the console.
 * @param directory - Vendor directory holding the private key.
 * @param certificateInput - Certificate text or file.
 * @param licensee - End customer name.
 * @param domainList - Comma-separated host names, IPv4 addresses or `/24` blocks.
 * @returns Exit code.
 */
async function issue(directory: string, certificateInput: string | undefined, licensee: string | undefined, domainList: string | undefined): Promise<number> {
  if (!certificateInput || !licensee?.trim()) throw new Error("--certificate and --licensee are required");
  const certificate = await readToken(certificateInput);
  const { payload, token } = await signQuireKitSubLicense(await readVendorKey(directory), certificate, {
    licensee, domains: (domainList ?? "").split(","), offline: true
  });
  await logIssuance(directory, { ...payload, certificate: parseOemCertificate(certificate)!.payload.id, key: token });
  process.stdout.write(`${token}\n`);
  return 0;
}

/**
 * Prints the payload of a key, certificate or sub-license without verifying it.
 * @param token - Token text.
 * @returns Exit code.
 */
function inspect(token: string): number {
  const body = token.replace(/^qk[cs]?1_/u, "").split(".")[0] ?? "";
  const bytes = decodeBase64url(body);
  if (!bytes) throw new Error("The token is malformed.");
  process.stdout.write(`${JSON.stringify(JSON.parse(new TextDecoder().decode(bytes)), null, 2)}\n`);
  return 0;
}
