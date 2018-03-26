const express = require("express");
const app = express();

var Redmine = require("node-redmine");
var Mustache = require("mustache");

var fs = require("fs");
var path = require("path");

var RSS = require("rss");

var cleanUrl = url =>
  ((/^https?:\/\//i.test(url) && url) || `https://${url}`).replace(/\/$/, "");

function getRSS(url, apiKey) {
  const cleaned_url = cleanUrl(url || process.env.URL);

  var redmine = new Redmine(cleaned_url, {
    apiKey: apiKey || process.env.API_KEY
  });

  /**
   * Dump issue
   */
  var add_issue = function(issue, feed, template) {
    console.log(issue);
    issue.journals.forEach(j => console.log(j, j.details));

    issue.journals.forEach((j, index) => {
      j.index = index + 1;
      j.url = `${cleaned_url}/issues/${issue.id}#change-${j.id}`;
    });

    const issue_url = issue.journals.length
      ? issue.journals[issue.journals.length - 1].url
      : `${cleaned_url}/issues/${issue.id}`;

    feed.item({
      title: `[${issue.project.name}] #${issue.id} - ${issue.subject} [${
        issue.tracker.name
      }]`,
      categories: [issue.tracker.name],
      url: issue_url,
      date: issue.updated_on.toUTCString(),
      author: (issue.journals.length
        ? issue.journals[issue.journals.length - 1].user
        : issue.author
      ).name,
      description: Mustache.render(
        template,
        Object.assign(
          {
            issue_url,
            reversed_journals: issue && [].concat(issue.journals).reverse()
          },
          issue
        )
      )
    });
  };

  return new Promise((resolve, reject) => {
    redmine.issues({ limit: 30, sort: "id:desc" }, function(err, data) {
      if (err) return reject(err);

      const issues = data.issues.map(issue => {
        return new Promise((resolve, reject) => {
          redmine.get_issue_by_id(
            issue.id,
            { include: "journals" },
            (err, data) => {
              (err && reject(err)) ||
                resolve(
                  Object.assign(
                    {},
                    issue,
                    Object.assign({}, data && data.issue, {
                      journals: (Array.isArray(
                        data && data.issue && data.issue.journals
                      )
                        ? data.issue.journals
                        : []
                      ).sort((a, b) => a.id - b.id)
                    })
                  )
                );
            }
          );
        });
      });

      Promise.all(issues).then(issues => {
        const final_issues = issues
          .map(issue => {
            return Object.assign({}, issue, {
              updated_on: new Date(Date.parse(issue.updated_on)),
              created_on: new Date(Date.parse(issue.updated_on))
            });
          })
          .sort((a, b) => b - a);

        /* lets create an rss feed */
        const feed = new RSS({
          title: "Redmine issues",
          description: `Redmine issues for ${cleaned_url}`,
          site_url: cleaned_url,
          pubDate: (
            (final_issues && final_issues[0].updated_on) ||
            new Date()
          ).toUTCString(),
          ttl: "1"
        });

        var template = fs.readFileSync(
          path.resolve(__dirname, "./templates/default.mst"),
          "utf8"
        );

        if (template) {
          try {
            template = fs.readFileSync(
              path.resolve(
                __dirname,
                "./templates/" + (template || "default.mst")
              ),
              "utf8"
            );
          } catch (e) {
            console.error(e);
          }
        }

        final_issues.reverse().forEach(i => add_issue(i, feed, template));

        resolve(feed.xml({ indent: true }));
      }, reject);
    });
  });
}

app.get("*", function(req, res) {
  getRSS(req.query.url, req.query.api_key, req.query.template).then(rss => {
    res.header("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(rss);
  }, res.send.bind(res));
});

app.listen(3000, function() {
  console.log("Example app listening on port 3000!");
});
