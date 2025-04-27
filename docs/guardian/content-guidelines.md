# Stripe Guardian Content Guidelines

This document outlines the standards and process for creating blog content for Stripe Guardian.

## 1. Front-Matter Rules

Every blog post `.mdx` file **must** include the following front-matter keys:

| Key       | Required | Example Format                              | Notes                                        |
| :-------- | :------- | :------------------------------------------ | :------------------------------------------- |
| `title`   | ✅       | `"Why We Built Stripe Guardian"`            | Keep it concise and descriptive.             |
| `date`    | ✅       | `2024-11-05`                                | Use `YYYY-MM-DD` format.                     |
| `excerpt` | ✅       | `"A founder's look at the payout-fraud..."` | Max 160 characters. Used for previews & SEO. |
| `tags`    | ✅       | `[origin, journey]`                         | See Tags Taxonomy below. At least one tag.   |
| `image`   | Optional | `/images/blog/guardian-origin-og.png`       | Path to custom OG image (1200x630).          |

## 2. File Naming & Location

- Place all blog posts in the `content/blog/` directory.
- Use the following naming convention: `YYYY-MM-slug.mdx`
- The `slug` should be lowercase kebab-case (e.g., `why-we-built-it`).

## 3. Image & Open Graph (OG) Requirements

- **Custom OG Image:** If you provide an `image` in the front matter:
  - It **must** be 1200 pixels wide by 630 pixels high (1.91:1 ratio).
  - Save it as a `.png` or `.jpg` file within `/public/images/blog/`.
  - Optimize the image size for web use.
- **Default OG Image:** If the `image` key is omitted, the system will first attempt to generate a dynamic OG image using the post title. If that fails, it will fall back to `/public/images/og-default.png`.
- **In-Post Images:** Use standard Markdown image syntax `![Alt Text](/path/to/image.png)`. Ensure descriptive alt text is included for accessibility.

## 4. Tone & Style

- **Voice:** Aim for a "knowledgeable dev lead" tone – helpful, direct, maybe slightly informal/sarcastic where appropriate, but always authoritative and trustworthy.
- **Clarity:** Explain technical concepts clearly. Avoid excessive jargon or buzzwords.
- **Formatting:**
  - Use headings up to `h3` (`###`).
  - Use Markdown code fences (`) for code snippets, specifying the language (e.g., `javascript`).
  - Use bullet points (`*`) or numbered lists (`1.`) for clarity.
  - Use blockquotes (`>`) for callouts or important notes.
- **Authenticity:** Do **not** include fictitious dollar amounts, customer names, or specific confidential customer anecdotes.
- **Emojis:** Use sparingly for emphasis where appropriate 👍.

## 5. Tags Taxonomy

Please use tags from the following list to categorize posts:

| Tag           | Purpose                                       |
| :------------ | :-------------------------------------------- |
| `origin`      | Company history, founding stories             |
| `journey`     | Founder perspectives, lessons learned         |
| `fraud`       | Fraud analysis, specific attack vectors       |
| `trends`      | Industry trends, market observations          |
| `product`     | General product updates, feature explanations |
| `beta`        | Updates specific to the beta program          |
| `roadmap`     | Future features, development plans            |
| `engineering` | Technical deep-dives, architectural decisions |
| `security`    | Broader security topics relevant to platforms |
| `case-study`  | (Future) Analysis of anonymized scenarios     |

## 6. Publishing Process

1.  **Draft:** Create your post as `.mdx` file in a feature branch (e.g., `feat/blog-<slug>`).
2.  **Self-Check:** Ensure all front-matter is correct, excerpt length is ≤ 160 characters, and file naming follows conventions.
3.  **Lint (Optional Local):** Run `npm run blog:lint` (if script exists) to check front-matter.
4.  **Pull Request:** Open a PR, including screenshots if relevant.
5.  **Review:** Assign reviewer `@mike-fuscoletti`.
6.  **Merge:** Once approved, merge the PR.
7.  **Verify:** After deployment, check the live post and its OG image (`view-source` or using an OG debugger tool).

## 7. Legal / Compliance

- **Confidentiality:** Absolutely no exposure of customer PII or confidential data.
- **Attribution:** Cite public sources with hyperlinks.
- **Disclaimer:** If expressing opinions, consider adding a brief disclaimer like: "Opinions expressed are the author's own and do not necessarily reflect the views of Stripe."
