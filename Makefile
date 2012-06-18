REPORTER = list

test:
	@NODE_ENV=test ./node_modules/.bin/mocha -u bdd --require should --reporter $(REPORTER)

test-cov: lib-cov
	@FLUENTFFMPEG_COV=1 $(MAKE) test REPORTER=html-cov > test/coverage.html

lib-cov:
	@rm -fr ./$@
	@jscoverage --no-highlight lib $@

.PHONY: test test-cov lib-cov