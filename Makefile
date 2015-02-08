all: test
test:
	@DEBUG=koala-puree* ./node_modules/.bin/mocha --harmony test
	$(MAKE) -C ./testApp/ all

.PHONY: test