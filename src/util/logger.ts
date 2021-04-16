import chalk from "chalk";
import util from "util";

function _log(prefix: string, template: string, ...fmt: unknown[]): void {
    const formatted = util.format(template, ...fmt);
    // eslint-disable-next-line no-control-regex
    const clean = prefix.replace(/\x1b\[\d+m/g, "");

    process.stdout.write(" ".repeat(10 - clean.length) + prefix + " " + formatted + "\n");
}

export function log(template: string, ...fmt: unknown[]): void {
    _log(chalk.grey("log ⬤"), template, ...fmt);
}

export function info(template: string, ...fmt: unknown[]): void {
    _log(chalk.blue("info ⬤"), template, ...fmt);
}

export function error(template: string, ...fmt: unknown[]): void {
    _log(chalk.red("error ✖"), template, ...fmt);
}

export function fatal(template: string, ...fmt: unknown[]): void {
    _log(chalk.red("fatal ✖"), template, ...fmt);
}

export function warn(template: string, ...fmt: unknown[]): void {
    _log(chalk.yellow("warn ⚠"), template, ...fmt);
}

export function success(template: string, ...fmt: unknown[]): void {
    _log(chalk.green("success ✓"), template, ...fmt);
}
export default {
    log,
    info,
    error,
    fatal,
    warn,
    success
};