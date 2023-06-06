const parse = (data) => {
  const parser = new DOMParser();
  const parsedData = parser.parseFromString(data, 'application/xml');

  const parseError = parsedData.querySelector('parsererror');
  if (parseError) {
    const error = new Error('invalidRSS');
    error.isParsingError = true;
    error.data = parseError.textContent;
    throw error;
  }

  const channel = parsedData.querySelector('channel');
  const title = channel.querySelector('title').textContent;
  const description = channel.querySelector('description').textContent;
  const feed = { title, description };

  const items = Array.from(parsedData.querySelectorAll('item'));

  const posts = items.map((item) => {
    const postTitle = item.querySelector('title').textContent;
    const postLink = item.querySelector('link').textContent;
    const postDescription = item.querySelector('description').textContent;
    return {
      title: postTitle,
      link: postLink,
      description: postDescription,
    };
  });

  return { feed, posts };
};

export default parse;
