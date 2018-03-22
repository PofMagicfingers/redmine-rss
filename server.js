const express = require("express");
const app = express();

var Redmine = require("node-redmine");
var RSS = require("rss");

// protocol required in Hostname, supports both HTTP and HTTPS
var hostname = "";
var config = {
  apiKey: ""
};

function getRSS() {
  var redmine = new Redmine(hostname, config);

  /**
   * Dump issue
   */
  var dump_issue = function(issue, feed) {
    feed.item(issue);
  };

  return new Promise((resolve, reject) => {
    redmine.issues({ limit: 100 }, function(err, data) {
      if (err) reject(err);

      /* lets create an rss feed */
      var feed = new RSS({
        title: "title",
        description: "description",
        feed_url: "http://example.com/rss.xml",
        site_url: "http://example.com",
        image_url: "http://example.com/icon.png",
        docs: "http://example.com/rss/docs.html",
        managingEditor: "Dylan Greene",
        webMaster: "Dylan Greene",
        copyright: "2013 Dylan Greene",
        language: "en",
        categories: ["Category 1", "Category 2", "Category 3"],
        pubDate: "May 20, 2012 04:00:00 GMT",
        ttl: "60",
        custom_namespaces: {
          itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd"
        },
        custom_elements: [
          { "itunes:subtitle": "A show about everything" },
          { "itunes:author": "John Doe" },
          {
            "itunes:summary":
              "All About Everything is a show about everything. Each week we dive into any subject known to man and talk about it as much as we can. Look for our podcast in the Podcasts app or in the iTunes Store"
          },
          {
            "itunes:owner": [
              { "itunes:name": "John Doe" },
              { "itunes:email": "john.doe@example.com" }
            ]
          },
          {
            "itunes:image": {
              _attr: {
                href:
                  "http://example.com/podcasts/everything/AllAboutEverything.jpg"
              }
            }
          },
          {
            "itunes:category": [
              {
                _attr: {
                  text: "Technology"
                }
              },
              {
                "itunes:category": {
                  _attr: {
                    text: "Gadgets"
                  }
                }
              }
            ]
          }
        ]
      });

      for (var i in data.issues) {
        dump_issue(data.issues[i], feed);
      }

      resolve(feed.xml({ indent: true }));
    });
  });
}

app.get("/", function(req, res) {
  getRSS().then(res.send.bind(res));
});

app.listen(3000, function() {
  console.log("Example app listening on port 3000!");
});
