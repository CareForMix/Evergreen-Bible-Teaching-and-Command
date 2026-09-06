import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from '../config.js';
import { pool } from '../lib/db.js';
import { requireAdmin } from '../middleware/auth.js';

import {
  galleryUpload,
  eventUpload,
  newsUpload
} from '../middleware/upload.js';

export const adminRouter = Router();

/* =========================================================
   LOGIN
========================================================= */

adminRouter.post('/login', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1)
    });

    const body = schema.parse(req.body);

    if (
      !config.adminEmail ||
      !config.adminPassword ||
      body.email !== config.adminEmail ||
      body.password !== config.adminPassword
    ) {
      return res.status(401).json({
        error: 'Invalid credentials.'
      });
    }

    const token = jwt.sign(
      {
        role: 'admin',
        email: body.email
      },
      config.jwtSecret,
      {
        expiresIn: '8h'
      }
    );

    res.json({
      token,
      expiresIn: '8h'
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.use(requireAdmin);

/* =========================================================
   SUBMISSIONS
========================================================= */

adminRouter.get('/submissions', async (req, res, next) => {
  try {
    const type = req.query.type;
    const values = [];
    let where = '';

    if (type) {
      values.push(type);
      where = 'where type=$1';
    }

    const q = await pool.query(
      `
      select
        id,
        type,
        name,
        email,
        message,
        created_at
      from submissions
      ${where}
      order by created_at desc
      limit 200
      `,
      values
    );

    res.json({
      items: q.rows
    });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   TEACHINGS
========================================================= */

adminRouter.post('/teachings', async (req, res, next) => {
  try {
    const schema = z.object({
      slug: z.string().min(2).max(160),
      title: z.string().min(2).max(240),
      summary: z.string().max(2000).optional().default(''),
      scripture: z.string().max(500).optional().default(''),
      published: z.boolean().optional().default(false)
    });

    const d = schema.parse(req.body);

    const q = await pool.query(
      `
      insert into teachings(
        slug,
        title,
        summary,
        scripture,
        published,
        published_at
      )
      values(
        $1,
        $2,
        $3,
        $4,
        $5,
        case when $5 then now() else null end
      )
      returning *
      `,
      [
        d.slug,
        d.title,
        d.summary,
        d.scripture,
        d.published
      ]
    );

    res.status(201).json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   EVENTS
========================================================= */

adminRouter.get('/events', async (_req, res, next) => {
  try {
    const q = await pool.query(`
      select
        id,
        title,
        description,
        starts_at,
        location,
        registration_url,
        image_url,
        created_at
      from events
      order by starts_at desc, id desc
      limit 200
    `);

    res.json({
      items: q.rows
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------
   CREATE EVENT USING IMAGE URL
--------------------------------------------------------- */

adminRouter.post('/events', async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(2).max(240),
      description: z.string().max(5000).optional().default(''),
      startsAt: z.string().datetime(),
      location: z.string().max(300).optional().default('Online'),
      registrationUrl: z
        .string()
        .url()
        .optional()
        .or(z.literal('')),
      imageUrl: z
        .string()
        .url()
        .optional()
        .or(z.literal(''))
    });

    const d = schema.parse(req.body);

    const q = await pool.query(
      `
      insert into events(
        title,
        description,
        starts_at,
        location,
        registration_url,
        image_url
      )
      values($1,$2,$3,$4,$5,$6)
      returning *
      `,
      [
        d.title,
        d.description,
        d.startsAt,
        d.location,
        d.registrationUrl || null,
        d.imageUrl || null
      ]
    );

    res.status(201).json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------
   CREATE EVENT WITH CLOUDINARY IMAGE UPLOAD
--------------------------------------------------------- */

adminRouter.post(
  '/events/upload',
  eventUpload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Event image is required.'
        });
      }

      const schema = z.object({
        title: z.string().min(2).max(240),

        description: z
          .string()
          .max(5000)
          .optional()
          .default(''),

        startsAt: z.string().datetime(),

        location: z
          .string()
          .max(300)
          .optional()
          .default('Online'),

        registrationUrl: z
          .string()
          .optional()
          .default('')
      });

      const d = schema.parse(req.body);

      // Permanent Cloudinary URL
      const imageUrl = req.file.path;

      const q = await pool.query(
        `
        insert into events(
          title,
          description,
          starts_at,
          location,
          registration_url,
          image_url
        )
        values($1,$2,$3,$4,$5,$6)
        returning *
        `,
        [
          d.title,
          d.description,
          d.startsAt,
          d.location,
          d.registrationUrl || null,
          imageUrl
        ]
      );

      res.status(201).json(q.rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   UPDATE EVENT
--------------------------------------------------------- */

adminRouter.patch('/events/:id', async (req, res, next) => {
  try {
    const id = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.id);

    const schema = z.object({
      title: z.string().min(2).max(240).optional(),

      description: z
        .string()
        .max(5000)
        .optional(),

      startsAt: z
        .string()
        .datetime()
        .optional(),

      location: z
        .string()
        .max(300)
        .optional(),

      registrationUrl: z
        .string()
        .url()
        .optional()
        .or(z.literal('')),

      imageUrl: z
        .string()
        .url()
        .optional()
        .or(z.literal(''))
    });

    const d = schema.parse(req.body);

    const current = await pool.query(
      `
      select *
      from events
      where id=$1
      `,
      [id]
    );

    if (!current.rows[0]) {
      return res.status(404).json({
        error: 'Event not found.'
      });
    }

    const old = current.rows[0];

    const q = await pool.query(
      `
      update events
      set
        title=$1,
        description=$2,
        starts_at=$3,
        location=$4,
        registration_url=$5,
        image_url=$6
      where id=$7
      returning *
      `,
      [
        d.title ?? old.title,
        d.description ?? old.description,
        d.startsAt ?? old.starts_at,
        d.location ?? old.location,

        d.registrationUrl !== undefined
          ? d.registrationUrl || null
          : old.registration_url,

        d.imageUrl !== undefined
          ? d.imageUrl || null
          : old.image_url,

        id
      ]
    );

    res.json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------
   DELETE EVENT
--------------------------------------------------------- */

adminRouter.delete('/events/:id', async (req, res, next) => {
  try {
    const id = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.id);

    const q = await pool.query(
      `
      delete from events
      where id=$1
      returning id
      `,
      [id]
    );

    if (!q.rows[0]) {
      return res.status(404).json({
        error: 'Event not found.'
      });
    }

    res.json({
      ok: true,
      id
    });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   ANNOUNCEMENTS
========================================================= */

adminRouter.get(
  '/announcements',
  async (_req, res, next) => {
    try {
      const q = await pool.query(`
        select
          id,
          title,
          body,
          link_url,
          active,
          published_at,
          created_at
        from announcements
        order by published_at desc, id desc
        limit 200
      `);

      res.json({
        items: q.rows
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   CREATE ANNOUNCEMENT
--------------------------------------------------------- */

adminRouter.post(
  '/announcements',
  async (req, res, next) => {
    try {
      const schema = z.object({
        title: z.string().min(2).max(240),

        body: z
          .string()
          .max(5000)
          .optional()
          .default(''),

        linkUrl: z
          .string()
          .optional()
          .default(''),

        active: z
          .boolean()
          .optional()
          .default(true)
      });

      const d = schema.parse(req.body);

      const q = await pool.query(
        `
        insert into announcements(
          title,
          body,
          link_url,
          active,
          published_at
        )
        values($1,$2,$3,$4,now())
        returning *
        `,
        [
          d.title,
          d.body,
          d.linkUrl || null,
          d.active
        ]
      );

      res.status(201).json(q.rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   UPDATE ANNOUNCEMENT
--------------------------------------------------------- */

adminRouter.patch(
  '/announcements/:id',
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.id);

      const schema = z.object({
        title: z
          .string()
          .min(2)
          .max(240)
          .optional(),

        body: z
          .string()
          .max(5000)
          .optional(),

        linkUrl: z
          .string()
          .optional(),

        active: z
          .boolean()
          .optional()
      });

      const d = schema.parse(req.body);

      const current = await pool.query(
        `
        select *
        from announcements
        where id=$1
        `,
        [id]
      );

      if (!current.rows[0]) {
        return res.status(404).json({
          error: 'Announcement not found.'
        });
      }

      const old = current.rows[0];

      const q = await pool.query(
        `
        update announcements
        set
          title=$1,
          body=$2,
          link_url=$3,
          active=$4
        where id=$5
        returning *
        `,
        [
          d.title ?? old.title,
          d.body ?? old.body,

          d.linkUrl !== undefined
            ? d.linkUrl || null
            : old.link_url,

          d.active ?? old.active,

          id
        ]
      );

      res.json(q.rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   DELETE ANNOUNCEMENT
--------------------------------------------------------- */

adminRouter.delete(
  '/announcements/:id',
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.id);

      const q = await pool.query(
        `
        delete from announcements
        where id=$1
        returning id
        `,
        [id]
      );

      if (!q.rows[0]) {
        return res.status(404).json({
          error: 'Announcement not found.'
        });
      }

      res.json({
        ok: true,
        id
      });
    } catch (e) {
      next(e);
    }
  }
);

/* =========================================================
   GALLERY
========================================================= */

adminRouter.get('/gallery', async (_req, res, next) => {
  try {
    const q = await pool.query(`
      select
        id,
        title,
        caption,
        image_url,
        category,
        active,
        published_at,
        created_at
      from gallery
      order by published_at desc, id desc
      limit 200
    `);

    res.json({
      items: q.rows
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------
   CREATE GALLERY ITEM USING IMAGE URL
--------------------------------------------------------- */

adminRouter.post('/gallery', async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(2).max(240),

      caption: z
        .string()
        .max(2000)
        .optional()
        .default(''),

      imageUrl: z.string().url(),

      category: z
        .string()
        .max(120)
        .optional()
        .default('Ministry'),

      active: z
        .boolean()
        .optional()
        .default(true)
    });

    const d = schema.parse(req.body);

    const q = await pool.query(
      `
      insert into gallery(
        title,
        caption,
        image_url,
        category,
        active,
        published_at
      )
      values($1,$2,$3,$4,$5,now())
      returning *
      `,
      [
        d.title,
        d.caption,
        d.imageUrl,
        d.category,
        d.active
      ]
    );

    res.status(201).json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------
   CREATE GALLERY ITEM WITH CLOUDINARY IMAGE UPLOAD
--------------------------------------------------------- */

adminRouter.post(
  '/gallery/upload',
  galleryUpload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Gallery image is required.'
        });
      }

      const schema = z.object({
        title: z.string().min(2).max(240),

        caption: z
          .string()
          .max(2000)
          .optional()
          .default(''),

        category: z
          .string()
          .max(120)
          .optional()
          .default('Ministry')
      });

      const d = schema.parse(req.body);

      // Permanent Cloudinary URL
      const imageUrl = req.file.path;

      const q = await pool.query(
        `
        insert into gallery(
          title,
          caption,
          image_url,
          category,
          active,
          published_at
        )
        values($1,$2,$3,$4,true,now())
        returning *
        `,
        [
          d.title,
          d.caption,
          imageUrl,
          d.category
        ]
      );

      res.status(201).json(q.rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   UPDATE GALLERY ITEM
--------------------------------------------------------- */

adminRouter.patch(
  '/gallery/:id',
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.id);

      const schema = z.object({
        title: z
          .string()
          .min(2)
          .max(240)
          .optional(),

        caption: z
          .string()
          .max(2000)
          .optional(),

        imageUrl: z
          .string()
          .url()
          .optional(),

        category: z
          .string()
          .max(120)
          .optional(),

        active: z
          .boolean()
          .optional()
      });

      const d = schema.parse(req.body);

      const current = await pool.query(
        `
        select *
        from gallery
        where id=$1
        `,
        [id]
      );

      if (!current.rows[0]) {
        return res.status(404).json({
          error: 'Gallery item not found.'
        });
      }

      const old = current.rows[0];

      const q = await pool.query(
        `
        update gallery
        set
          title=$1,
          caption=$2,
          image_url=$3,
          category=$4,
          active=$5
        where id=$6
        returning *
        `,
        [
          d.title ?? old.title,
          d.caption ?? old.caption,
          d.imageUrl ?? old.image_url,
          d.category ?? old.category,
          d.active ?? old.active,
          id
        ]
      );

      res.json(q.rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   DELETE GALLERY ITEM
--------------------------------------------------------- */

adminRouter.delete(
  '/gallery/:id',
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.id);

      const q = await pool.query(
        `
        delete from gallery
        where id=$1
        returning id
        `,
        [id]
      );

      if (!q.rows[0]) {
        return res.status(404).json({
          error: 'Gallery item not found.'
        });
      }

      res.json({
        ok: true,
        id
      });
    } catch (e) {
      next(e);
    }
  }
);

/* =========================================================
   NEWS
========================================================= */

adminRouter.get('/news', async (_req, res, next) => {
  try {
    const q = await pool.query(`
      select
        id,
        title,
        summary,
        body,
        image_url,
        link_url,
        active,
        published_at,
        created_at
      from news
      order by published_at desc, id desc
      limit 200
    `);

    res.json({
      items: q.rows
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------
   CREATE NEWS USING IMAGE URL
--------------------------------------------------------- */

adminRouter.post('/news', async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(2).max(240),

      summary: z
        .string()
        .max(1000)
        .optional()
        .default(''),

      body: z
        .string()
        .max(10000)
        .optional()
        .default(''),

      imageUrl: z
        .string()
        .url()
        .optional()
        .or(z.literal('')),

      linkUrl: z
        .string()
        .optional()
        .default(''),

      active: z
        .boolean()
        .optional()
        .default(true)
    });

    const d = schema.parse(req.body);

    const q = await pool.query(
      `
      insert into news(
        title,
        summary,
        body,
        image_url,
        link_url,
        active,
        published_at
      )
      values($1,$2,$3,$4,$5,$6,now())
      returning *
      `,
      [
        d.title,
        d.summary,
        d.body,
        d.imageUrl || null,
        d.linkUrl || null,
        d.active
      ]
    );

    res.status(201).json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------
   CREATE NEWS WITH CLOUDINARY IMAGE UPLOAD
--------------------------------------------------------- */

adminRouter.post(
  '/news/upload',
  newsUpload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'News image is required.'
        });
      }

      const schema = z.object({
        title: z.string().min(2).max(240),

        summary: z
          .string()
          .max(1000)
          .optional()
          .default(''),

        body: z
          .string()
          .max(10000)
          .optional()
          .default(''),

        linkUrl: z
          .string()
          .optional()
          .default(''),

        active: z
          .enum(['true', 'false'])
          .optional()
          .default('true')
          .transform((value) => value === 'true')
      });

      const d = schema.parse(req.body);

      // Permanent Cloudinary URL
      const imageUrl = req.file.path;

      const q = await pool.query(
        `
        insert into news(
          title,
          summary,
          body,
          image_url,
          link_url,
          active,
          published_at
        )
        values($1,$2,$3,$4,$5,$6,now())
        returning *
        `,
        [
          d.title,
          d.summary,
          d.body,
          imageUrl,
          d.linkUrl || null,
          d.active
        ]
      );

      res.status(201).json(q.rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   UPDATE NEWS
--------------------------------------------------------- */

adminRouter.patch(
  '/news/:id',
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.id);

      const schema = z.object({
        title: z
          .string()
          .min(2)
          .max(240)
          .optional(),

        summary: z
          .string()
          .max(1000)
          .optional(),

        body: z
          .string()
          .max(10000)
          .optional(),

        imageUrl: z
          .string()
          .url()
          .optional()
          .or(z.literal('')),

        linkUrl: z
          .string()
          .optional(),

        active: z
          .boolean()
          .optional()
      });

      const d = schema.parse(req.body);

      const current = await pool.query(
        `
        select *
        from news
        where id=$1
        `,
        [id]
      );

      if (!current.rows[0]) {
        return res.status(404).json({
          error: 'News item not found.'
        });
      }

      const old = current.rows[0];

      const q = await pool.query(
        `
        update news
        set
          title=$1,
          summary=$2,
          body=$3,
          image_url=$4,
          link_url=$5,
          active=$6
        where id=$7
        returning *
        `,
        [
          d.title ?? old.title,
          d.summary ?? old.summary,
          d.body ?? old.body,

          d.imageUrl !== undefined
            ? d.imageUrl || null
            : old.image_url,

          d.linkUrl !== undefined
            ? d.linkUrl || null
            : old.link_url,

          d.active ?? old.active,

          id
        ]
      );

      res.json(q.rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/* ---------------------------------------------------------
   DELETE NEWS
--------------------------------------------------------- */

adminRouter.delete(
  '/news/:id',
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.id);

      const q = await pool.query(
        `
        delete from news
        where id=$1
        returning id
        `,
        [id]
      );

      if (!q.rows[0]) {
        return res.status(404).json({
          error: 'News item not found.'
        });
      }

      res.json({
        ok: true,
        id
      });
    } catch (e) {
      next(e);
    }
  }
);