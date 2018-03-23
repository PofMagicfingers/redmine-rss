const express = require("express");
const app = express();

var Redmine = require("node-redmine");
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
  var add_issue = function(issue, feed) {
    console.log(issue);
    console.log(issue.journals);
    feed.item({
      title: `[${issue.project.name}] #${issue.id} - ${issue.subject} [${
        issue.tracker.name
      }]`,
      categories: [issue.tracker.name],
      url: `${cleaned_url}/issues/${issue.id}${
        issue.journals.length
          ? "#change-" + issue.journals[issue.journals.length - 1].id
          : ""
      }`,
      date: issue.updated_on.toUTCString(),
      author: (issue.journals.length
        ? issue.journals[issue.journals.length - 1].user
        : issue.author
      ).name
    });
  };

  return new Promise((resolve, reject) => {
    redmine.issues({ limit: 30 }, function(err, data) {
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
                    Object.assign({}, data.issue, {
                      journals: (Array.isArray(data.issue.journals)
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

        final_issues.reverse().forEach(i => add_issue(i, feed));

        resolve(feed.xml({ indent: true }));
      }, reject);
    });
  });
}

app.get("*", function(req, res) {
  getRSS(req.query.url, req.query.api_key).then(rss => {
    res.header("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(rss);
  }, res.send.bind(res));
});

app.listen(3000, function() {
  console.log("Example app listening on port 3000!");
});
