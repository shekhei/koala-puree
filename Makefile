all: test
test:
	$(MAKE) -C ./test/ all

.PHONY: test