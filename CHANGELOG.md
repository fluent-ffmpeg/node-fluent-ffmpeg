# fluent-ffmpeg changelog

## Unreleased

### Breaking changes

- Complete API rewrite
- Drop support for Node.js < 18
- Drop support for flvtool/flvmeta
- Drop support for avconv/avprobe

### New features

- No dependencies
- Built-in typescript types

### Development

- Native typescript
- Use yarn for dependency management
- Use ava for the test suite
- Use sinon for mocks
- Use c8 for code coverage
- Use prettier for linting
- Use typedoc for documentation generation
- Use Github Actions for CI
- Use coveralls for coverage reports
- Drop FOSSA, useless since we have no runtime dependencies
