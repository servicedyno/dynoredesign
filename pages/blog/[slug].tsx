import React from "react";
import { Box, Typography, useTheme, Divider } from "@mui/material";
import { useRouter } from "next/router";
import Head from "next/head";
import { getBlogPost, blogPosts } from "@/utils/blogData";
import useIsMobile from "@/hooks/useIsMobile";
import HomeHeader from "@/Components/Layout/HomeHeader";
import type { GetStaticPaths, GetStaticProps } from "next";

const categoryColors: Record<string, string> = {
  "Integration Guide": "#0004FF",
  "Business Strategy": "#10B981",
  "Cost Analysis": "#F59E0B",
  "Developer Guide": "#7C3AED",
};

interface BlogPostPageProps {
  slug: string;
}

const BlogPostPage = ({ slug }: BlogPostPageProps) => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";
  const post = getBlogPost(slug);

  if (!post) {
    return (
      <>
        <HomeHeader />
        <Box sx={{ pt: 20, textAlign: "center", minHeight: "100vh" }}>
          <Typography variant="h4" sx={{ fontFamily: "UrbanistSemibold", color: theme.palette.text.primary }}>
            Post not found
          </Typography>
          <Typography
            onClick={() => router.push("/blog")}
            sx={{
              mt: 2,
              cursor: "pointer",
              color: theme.palette.primary.main,
              fontFamily: "UrbanistMedium",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            &larr; Back to blog
          </Typography>
        </Box>
      </>
    );
  }

  const catColor = categoryColors[post.category] || theme.palette.primary.main;

  // Simple markdown-like renderer
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];
    let codeKey = 0;
    let inTable = false;
    let tableRows: string[][] = [];
    let tableKey = 0;

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(2); // skip separator
        elements.push(
          <Box
            key={`table-${tableKey++}`}
            sx={{
              overflowX: "auto",
              my: 3,
              borderRadius: "12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: isMobile ? "13px" : "14px",
                fontFamily: "UrbanistMedium",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  }}
                >
                  {headerRow.map((cell, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: "left",
                        padding: "10px 16px",
                        fontWeight: 600,
                        color: isDark ? "#C8CAD5" : "#374151",
                        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                      }}
                    >
                      {cell.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: "10px 16px",
                          color: isDark ? "#A8AAB5" : "#4B5563",
                          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                        }}
                      >
                        {cell.trim()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        );
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.trim().startsWith("```")) {
        if (inTable) flushTable();
        if (inCodeBlock) {
          elements.push(
            <Box
              key={`code-${codeKey++}`}
              sx={{
                my: 2.5,
                borderRadius: "12px",
                bgcolor: isDark ? "#0D0F1A" : "#1E1E2E",
                border: `1px solid ${isDark ? "#1E2030" : "rgba(255,255,255,0.06)"}`,
                overflow: "auto",
              }}
            >
              <pre
                style={{
                  padding: "20px 16px",
                  margin: 0,
                  fontSize: "13px",
                  lineHeight: 1.65,
                  color: "#CDD6F4",
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                }}
              >
                {codeLines.join("\n")}
              </pre>
            </Box>
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Tables
      if (line.trim().startsWith("|")) {
        inTable = true;
        const cells = line.split("|").filter((c) => c.trim() !== "");
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Empty lines
      if (line.trim() === "") continue;

      // Headers
      if (line.startsWith("## ")) {
        elements.push(
          <Typography
            key={`h2-${i}`}
            sx={{
              fontSize: isMobile ? "22px" : "28px",
              fontFamily: "UrbanistSemibold",
              fontWeight: 700,
              color: theme.palette.text.primary,
              mt: 5,
              mb: 2,
              lineHeight: 1.3,
            }}
          >
            {line.replace("## ", "")}
          </Typography>
        );
        continue;
      }
      if (line.startsWith("### ")) {
        elements.push(
          <Typography
            key={`h3-${i}`}
            sx={{
              fontSize: isMobile ? "18px" : "22px",
              fontFamily: "UrbanistSemibold",
              fontWeight: 600,
              color: theme.palette.text.primary,
              mt: 4,
              mb: 1.5,
              lineHeight: 1.3,
            }}
          >
            {line.replace("### ", "")}
          </Typography>
        );
        continue;
      }

      // List items
      if (line.startsWith("- ")) {
        const text = line.replace("- ", "");
        elements.push(
          <Box key={`li-${i}`} sx={{ display: "flex", gap: 1.5, mb: 1, pl: 1 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                minWidth: 6,
                borderRadius: "50%",
                bgcolor: theme.palette.primary.main,
                mt: 1,
              }}
            />
            <Typography
              sx={{
                fontSize: isMobile ? "14px" : "16px",
                fontFamily: "UrbanistMedium",
                color: theme.palette.text.secondary,
                lineHeight: 1.7,
              }}
              dangerouslySetInnerHTML={{
                __html: text
                  .replace(/\*\*(.*?)\*\*/g, '<strong style="color: ' + (isDark ? "#E5E7EB" : "#1F2937") + '">$1</strong>')
                  .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #0004FF; text-decoration: none;">$1</a>')
                  .replace(/`(.*?)`/g, '<code style="background: ' + (isDark ? "#1E2030" : "#F3F4F6") + '; padding: 1px 5px; border-radius: 4px; font-size: 13px;">$1</code>'),
              }}
            />
          </Box>
        );
        continue;
      }

      // Numbered list
      const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
      if (numberedMatch) {
        elements.push(
          <Box key={`ol-${i}`} sx={{ display: "flex", gap: 1.5, mb: 1, pl: 1 }}>
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "UrbanistSemibold",
                color: theme.palette.primary.main,
                minWidth: 20,
              }}
            >
              {numberedMatch[1]}.
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "14px" : "16px",
                fontFamily: "UrbanistMedium",
                color: theme.palette.text.secondary,
                lineHeight: 1.7,
              }}
              dangerouslySetInnerHTML={{
                __html: numberedMatch[2]
                  .replace(/\*\*(.*?)\*\*/g, '<strong style="color: ' + (isDark ? "#E5E7EB" : "#1F2937") + '">$1</strong>')
                  .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #0004FF; text-decoration: none;">$1</a>')
                  .replace(/`(.*?)`/g, '<code style="background: ' + (isDark ? "#1E2030" : "#F3F4F6") + '; padding: 1px 5px; border-radius: 4px; font-size: 13px;">$1</code>'),
              }}
            />
          </Box>
        );
        continue;
      }

      // Paragraph
      elements.push(
        <Typography
          key={`p-${i}`}
          sx={{
            fontSize: isMobile ? "14px" : "16px",
            fontFamily: "UrbanistMedium",
            color: theme.palette.text.secondary,
            lineHeight: 1.8,
            mb: 2,
          }}
          dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*(.*?)\*\*/g, '<strong style="color: ' + (isDark ? "#E5E7EB" : "#1F2937") + '">$1</strong>')
              .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #0004FF; text-decoration: none;">$1</a>')
              .replace(/`(.*?)`/g, '<code style="background: ' + (isDark ? "#1E2030" : "#F3F4F6") + '; padding: 1px 5px; border-radius: 4px; font-size: 13px;">$1</code>')
              .replace(/\\"(.*?)\\"/g, '"$1"'),
          }}
        />
      );
    }

    if (inTable) flushTable();
    return elements;
  };

  return (
    <>
      <Head>
        <title>{post.title} | Dynopay Blog</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={post.publishedAt} />
        <link rel="canonical" href={`https://dynopay.com/blog/${post.slug}`} />
      </Head>

      <HomeHeader />

      <Box
        sx={{
          pt: isMobile ? 12 : 16,
          pb: isMobile ? 6 : 10,
          px: isMobile ? 2 : 4,
          maxWidth: 800,
          mx: "auto",
          minHeight: "100vh",
        }}
      >
        {/* Back link */}
        <Typography
          onClick={() => router.push("/blog")}
          sx={{
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "UrbanistSemibold",
            color: theme.palette.primary.main,
            mb: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          &larr; Back to blog
        </Typography>

        {/* Category + meta */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.4,
              borderRadius: "8px",
              bgcolor: `${catColor}15`,
              border: `1px solid ${catColor}30`,
            }}
          >
            <Typography
              sx={{
                fontSize: "11px",
                fontFamily: "UrbanistSemibold",
                fontWeight: 600,
                color: catColor,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {post.category}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: "12px",
              fontFamily: "UrbanistMedium",
              color: theme.palette.text.secondary,
            }}
          >
            {post.readTime}
          </Typography>
          <Typography
            sx={{
              fontSize: "12px",
              fontFamily: "UrbanistMedium",
              color: theme.palette.text.secondary,
            }}
          >
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Typography>
        </Box>

        {/* Title */}
        <Typography
          sx={{
            fontSize: isMobile ? "28px" : "42px",
            fontFamily: "UrbanistSemibold",
            fontWeight: 700,
            color: theme.palette.text.primary,
            lineHeight: 1.2,
            mb: 2,
          }}
        >
          {post.title}
        </Typography>

        {/* Author */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: `${catColor}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "15px",
              fontFamily: "UrbanistSemibold",
              color: catColor,
            }}
          >
            {post.author.name.charAt(0)}
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "UrbanistSemibold",
                color: theme.palette.text.primary,
                lineHeight: 1.3,
              }}
            >
              {post.author.name}
            </Typography>
            <Typography
              sx={{
                fontSize: "12px",
                fontFamily: "UrbanistMedium",
                color: theme.palette.text.secondary,
              }}
            >
              {post.author.role}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4, borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />

        {/* Content */}
        <Box>{renderContent(post.content)}</Box>

        <Divider sx={{ my: 5, borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />

        {/* CTA */}
        <Box
          sx={{
            textAlign: "center",
            py: 5,
            px: 3,
            borderRadius: "20px",
            bgcolor: isDark ? "rgba(0,4,255,0.04)" : "rgba(0,4,255,0.02)",
            border: `1px solid ${isDark ? "rgba(0,4,255,0.15)" : "rgba(0,4,255,0.08)"}`,
          }}
        >
          <Typography
            sx={{
              fontSize: isMobile ? "20px" : "24px",
              fontFamily: "UrbanistSemibold",
              fontWeight: 700,
              color: theme.palette.text.primary,
              mb: 1.5,
            }}
          >
            Ready to accept crypto payments?
          </Typography>
          <Typography
            sx={{
              fontSize: "15px",
              fontFamily: "UrbanistMedium",
              color: theme.palette.text.secondary,
              mb: 3,
            }}
          >
            Get started in minutes with Dynopay&apos;s simple API integration.
          </Typography>
          <Box
            component="a"
            href="/auth/register"
            sx={{
              display: "inline-flex",
              px: 4,
              py: 1.5,
              borderRadius: "12px",
              bgcolor: theme.palette.primary.main,
              color: "#fff",
              textDecoration: "none",
              fontFamily: "UrbanistSemibold",
              fontSize: "15px",
              fontWeight: 600,
              transition: "all 0.2s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 8px 24px rgba(0,4,255,0.25)",
              },
            }}
          >
            Start Accepting Crypto &rarr;
          </Box>
        </Box>
      </Box>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = blogPosts.map((post) => ({
    params: { slug: post.slug },
  }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<BlogPostPageProps> = async ({ params }) => {
  return {
    props: {
      slug: params?.slug as string,
    },
  };
};

export default BlogPostPage;
