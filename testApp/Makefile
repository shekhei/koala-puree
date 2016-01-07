all: test
test:
	@DEBUG=koala-puree* ./node_modules/.bin/babel-node ./node_modules/.bin/babel-istanbul cover ./node_modules/.bin/_mocha -- --reporter dot test

.PHONY: test
