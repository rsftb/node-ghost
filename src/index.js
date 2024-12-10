'use strict';

function getIndexPage(argsPaths)
{
    const index_top = `
    <!doctype html>
    <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>minihost: serving [${argsPaths.join(', ')}]</title>
            <style>
                /* Unique background colors for debugging */
                body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                }
                span.dir-title {
                color: green;
                cursor: pointer;
                width: fit-content;
                }
                span.dir-title:before {
                content: '📁';
                }
                a.item {
                color: orange;
                }
                ul.explorer-root {
                list-style-type: none;
                padding-inline-start: 0;
                }
                ul.explorer-root li {
                display: flex;
                align-items: left;
                }
                ul.explorer-root li.dir {
                display: flex;
                flex-direction: column;
                }
                ul.explorer-root li.file {
                display: flex;
                flex-direction: column;
                }
                /* add item icons */
            </style>
        </head>
        <body>
            <header id="title">
                <h1>minihost</h1>
                <p>serving [${argsPaths.join(', ')}]</p>
            </header>

            <section id="explorer-main" style="
                display: flex;
                padding: 2ch;
                background-color: gray;
            ">
                <div id="explorer-contents">
                    <ul class="explorer-root">
    `;

    const index_bottom = `
                    </ul>
                </div>

            </section>

            <footer id="footer">
                <p>all rights reserved</p>
            </footer>
        </body>

    </html>
    `;

    const index_script = `
    <script lang="js">

        function directories_set_toggle(root)
        {
            root.querySelectorAll(":scope > .dir").forEach((dir) => {
                dir.querySelector('.dir-title').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dirContents = dir.querySelector('.dir-contents');
                    if (dirContents.style.display === 'none') {
                        dirContents.style.display = 'block';
                    } else {
                        dirContents.style.display = 'none';
                    }
                });

                console.log(dir.querySelector('.dir-contents'));
                directories_set_toggle(dir.querySelector('.dir-contents'));
            });
        }

        const explorerRoot = document.querySelector('.explorer-root');
        directories_set_toggle(explorerRoot);

    </script>
    `;

    return [index_top, index_bottom, index_script];
}

module.exports = { getIndexPage };