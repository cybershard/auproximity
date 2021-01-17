import chalk from "chalk";
import util from "util";

function _log(prefix: string, template: string, ...fmt: any[]): void {
    const formatted = util.format(template, ...fmt);
    const clean = prefix.replace(/\x1b\[\d+m/g, "");

    process.stdout.write(" ".repeat(10 - clean.length) + prefix + " " + formatted + "\n");
}

export function log(template: string, ...fmt: any[]): void {
    _log(chalk.grey("log ⬤"), template, ...fmt);
}

export function info(template: string, ...fmt: any[]): void {
    _log(chalk.blue("info ⬤"), template, ...fmt);
}

export function error(template: string, ...fmt: any[]): void {
    _log(chalk.red("error ✖"), template, ...fmt);
}

export function fatal(template: string, ...fmt: any[]): void {
    _log(chalk.red("fatal ✖"), template, ...fmt);
}

export function warn(template: string, ...fmt: any[]): void {
    _log(chalk.yellow("warn ⚠"), template, ...fmt);
}

export function success(template: string, ...fmt: any[]): void {
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