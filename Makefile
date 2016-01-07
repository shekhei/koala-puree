all: test
test:
	@NODE_ENV=test DEBUG=koala-puree* ./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- --reporter dot test testApp/test
.PHONY: test

