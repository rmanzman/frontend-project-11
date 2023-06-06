import * as yup from 'yup';
import i18n from 'i18next';
import axios from 'axios';
import { uniqueId } from 'lodash';

import onChange from 'on-change';
import ru from './locales/ru.js';
import render from './view.js';
import parse from './parser.js';

const timeout = 5000;

const validate = (url, links) => {
  const schema = yup.string().trim().required().url()
    .notOneOf(links);
  return schema.validate(url);
};

const proxy = (url) => {
  const proxyLink = 'https://allorigins.hexlet.app/get';
  const proxyLinkWithParams = new URL(proxyLink);
  proxyLinkWithParams.searchParams.set('disableCache', true);
  proxyLinkWithParams.searchParams.set('url', url);
  return proxyLinkWithParams.toString();
};

const getAxiosResponse = (url) => {
  const preparedLink = proxy(url);
  return axios.get(preparedLink);
};

const addPosts = (feedId, posts) => {
  const updatedPosts = posts.map((post) => ({ ...post, feedId, id: uniqueId() }));
  return updatedPosts;
};

const fetchNewPosts = (state) => {
  const promises = state.content.feeds
    .map(({ link, id }) => getAxiosResponse(link)
      .then((response) => {
        const { posts } = parse(response.data.contents);
        const alreadyAddedLinks = state.content.posts.map((post) => post.link);
        const newPosts = posts.filter((post) => !alreadyAddedLinks.includes(post.link));
        if (newPosts.length > 0) {
          state.content.posts = [...state.content.posts, ...addPosts(id, newPosts)];
        }
      }));
  Promise.allSettled(promises)
    .finally(() => {
      setTimeout(() => fetchNewPosts(state), timeout);
    });
};

const app = () => {
  const i18nInstance = i18n.createInstance();
  i18nInstance.init({
    lng: 'ru',
    debug: false,
    resources: {
      ru,
    },
  }).then((translate) => {
    const elements = {
      form: document.querySelector('.rss-form'),
      feedback: document.querySelector('.feedback'),
      input: document.querySelector('#url-input'),
      btn: document.querySelector('button[type="submit"]'),
      posts: document.querySelector('.posts'),
      feeds: document.querySelector('.feeds'),
      modal: {
        modalElement: document.querySelector('.modal'),
        title: document.querySelector('.modal-title'),
        body: document.querySelector('.modal-body'),
        btn: document.querySelector('.full-article'),
      },
    };

    yup.setLocale({
      mixed: { notOneOf: 'alreadyExistsRSS' },
      string: { url: 'invalidURL', required: 'shouldNotBeBlank' },
    });

    const state = {
      form: {
        state: 'filling',
        error: null,
      },
      content: {
        feeds: [],
        posts: [],
      },
      uiState: {
        visitedLinksIds: new Set(),
        modalPostId: null,
      },
    };

    const watchedState = onChange(state, render(state, elements, translate));

    fetchNewPosts(watchedState);

    elements.form.addEventListener('input', () => {
      watchedState.form.error = null;
      watchedState.form.state = 'filling';
    });

    elements.form.focus();
    elements.form.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(elements.form);
      const url = formData.get('url');
      const addedLinks = watchedState.content.feeds.map(({ link }) => link);

      watchedState.form.error = null;
      watchedState.form.state = 'sending';

      validate(url, addedLinks)
        .then((link) => getAxiosResponse(link))
        .then((response) => {
          const { feed, posts } = parse(response.data.contents);
          const feedId = uniqueId();
          watchedState.content.feeds.push({ ...feed, feedId, link: url });
          watchedState.content.posts = addPosts(feedId, posts);
          watchedState.form.state = 'success';
        })
        .catch((error) => {
          const errorMessage = error.message ?? 'defaultError';
          watchedState.form.error = errorMessage;
          watchedState.form.state = 'error';
        });
    });

    elements.modal.modalElement.addEventListener('show.bs.modal', (e) => {
      const postId = e.relatedTarget.getAttribute('data-id');
      watchedState.uiState.visitedLinksIds.add(postId);
      watchedState.uiState.modalPostId = postId;
    });

    elements.posts.addEventListener('click', (e) => {
      const postId = e.target.dataset.id;
      if (postId) watchedState.uiState.visitedLinksIds.add(postId);
    });
  });
};

export default app;
