const childProcess = require('child_process');
const fs = require('fs');

function git(...args) {
	console.log(`\u001b[36mgit\u001b[0m ${args.join(' ')}`);

	return new Promise((resolve, reject) => {
		childProcess.exec(`git ${args.join(' ')}`, (error, stdOut, stdErr) => {
			if (error) {
				return reject(error);
			}

			if (stdErr) {
				return reject(stdErr);
			}

			resolve(stdOut);
		});
	});
}

function gitSatus() {
	return git('status', '--porcelain').then((stdOut) => {
		if (stdOut.length > 0) {
			return Promise.reject('STATUS ERROR');
		}
	});
}

function gitMerge(...args) {
	return git('merge', ...args).then(() => {
		return gitSatus();
	}).catch((error) => {
		return git('merge', '--abort').then(() => {
			return Promise.reject(error);
		});
	});
}

function incrementPackage(increment) {
	return Promise.resolve().then(() => {
		return new Promise((resolve, reject) => {
			fs.readFile('package.json', 'utf8', (error, pkg) => {
				if (error) {
					return reject(error);
				}

				resolve(JSON.parse(pkg));
			});
		});
	}).then((pkg) => {
		let [major, minor, patch] = pkg.version.split('.');

		switch (increment.toUpperCase()) {
			case 'MAJOR':
				major = (+major) + 1;
				break;

			case 'MINOR':
				minor = (+minor) + 1;
				break;

			case 'PATCH':
				patch = (+patch) + 1;
				break;
		}

		pkg.version = [major, minor, patch].join('.');

		return pkg;
	}).then((pkg) => {
		return new Promise((resolve, reject) => {
			fs.writeFile('package.json', JSON.stringify(pkg, null, 2), (error) => {
				if (error) {
					return reject(error);
				}

				resolve(pkg);
			});
		});
	}).then((pkg) => {
		return git('add', 'package.json').then(() => {
			return git('commit', '-m', `"Set version to ${pkg.version}"`).then(() => {
				return pkg;
			});
		});
	});
}

module.exports = function (branch, increment) {
	return git('rev-parse', '--abbrev-ref', 'HEAD').then((currentBranch) => {
		return gitSatus().then(() => {
			return gitMerge(branch, '--no-commit');
		}).then(() => {
			return incrementPackage(increment);
		}).then((pkg) => {
			return Promise.resolve().then(() => {
				return git('checkout', branch).catch(() => { }); // WHY DOES THIS RETURN AN ERROR
			}).then(() => {
				return gitMerge(currentBranch);
			}).then(() => {
				return git('tag', pkg.version);
			});
		});
	});
};
