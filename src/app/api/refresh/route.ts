import { NextResponse } from "next/server";

export async function POST() {
  // Production: trigger GitHub Actions workflow_dispatch
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (githubToken && githubRepo) {
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${githubRepo}/actions/workflows/manual-scrape.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: "main" }),
        }
      );

      if (resp.status === 204) {
        return NextResponse.json({ success: true, mode: "github_actions" });
      } else {
        const text = await resp.text();
        return NextResponse.json(
          { error: `GitHub API error: ${resp.status} ${text}` },
          { status: 500 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: `GitHub API request failed: ${e}` },
        { status: 500 }
      );
    }
  }

  // Local development: spawn Python subprocess
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      ["scrapers/run_all.py"],
      { cwd: process.cwd(), timeout: 120000 }
    );
    return NextResponse.json({
      success: true,
      mode: "local",
      stdout: stdout.slice(-2000),
      stderr: stderr.slice(-2000),
    });
  } catch (e: unknown) {
    const err = e as { message?: string; stdout?: string; stderr?: string };
    return NextResponse.json(
      {
        error: err.message || "Scrape failed",
        stdout: err.stdout?.slice(-2000),
        stderr: err.stderr?.slice(-2000),
      },
      { status: 500 }
    );
  }
}
