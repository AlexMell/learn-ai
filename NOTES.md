# Notes

Personal knowledge base — things learned, found online, worth remembering.

---

## Claude Code: `.claude/commands/` vs `.claude/skills/`

**commands/** — prompt shortcuts
- Файл стає промптом, який Claude отримує тільки в момент виклику `/command-name`
- Claude не знає про них до виклику
- Підходить для: простих одноразових промптів, шаблонів

**skills/** — structured workflows
- Завантажуються в системний контекст на початку кожної сесії (видно у `system-reminder` як "available skills")
- Claude може проактивно запропонувати skill коли бачить відповідну ситуацію
- Підходить для: multi-step workflows, складних автоматизацій

**Правило**: використовуй `skills/` для складних workflows де хочеш проактивну поведінку; `commands/` для простих prompt-шаблонів.
