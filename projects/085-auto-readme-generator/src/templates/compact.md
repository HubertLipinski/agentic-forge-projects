# {{project.name}}

> {{project.description}}

{{#project.homepage}}
[**Homepage**]({{.}})
{{/project.homepage}}
{{#project.repository.url}}
• [**Repository**]({{.}})
{{/project.repository.url}}
{{#project.bugs.url}}
• [**Issues**]({{.}})
{{/project.bugs.url}}

---

## Installation

```bash
{{packageManager}} install {{project.name}}
```

{{#project.scripts}}
## Scripts

{{#project.scripts}}
- `{{packageManager}} run {{key}}`: Runs `{{value}}`
{{/project.scripts}}
{{/project.scripts}}

{{#api}}
## API

{{{api}}}
{{/api}}

{{#contributing}}
## Contributing

Contributions are welcome! Please see `CONTRIBUTING.md` for details.
{{/contributing}}

{{#license}}
## License

Licensed under the {{project.license}} license. See the [LICENSE]({{license.path}}) file for more details.
{{/license}}