from flask import Blueprint, request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_jwt_extended.exceptions import NoAuthorizationError

from app.models import db
from app.models.item import Item


class CustomApi(Api):
    # Make JWT "Missing Authorization Header" return 401 instead of 500
    def handle_error(self, e):
        if isinstance(e, NoAuthorizationError):
            return {"error": "Missing Authorization Header"}, 401
        return super().handle_error(e)


api_bp = Blueprint("api", __name__)
api = CustomApi(api_bp)


class ItemListResource(Resource):

    @jwt_required()
    def get(self):
        user_id = int(get_jwt_identity())
        items = Item.query.filter_by(user_id=user_id).all()
        return [i.to_dict() for i in items], 200

    @jwt_required()
    def post(self):
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        title = data.get("title")
        if not title:
            return {"error": "title is required"}, 400

        item = Item(
            title=title,
            is_done=bool(data.get("is_done", False)),
            user_id=user_id,
        )
        db.session.add(item)
        db.session.commit()

        return item.to_dict(), 201


class ItemResource(Resource):

    @jwt_required()
    def get(self, item_id):
        user_id = int(get_jwt_identity())
        item = Item.query.filter_by(id=item_id, user_id=user_id).first()
        if not item:
            return {"error": "not found"}, 404
        return item.to_dict(), 200

    @jwt_required()
    def put(self, item_id):
        user_id = int(get_jwt_identity())
        item = Item.query.filter_by(id=item_id, user_id=user_id).first()
        if not item:
            return {"error": "not found"}, 404

        data = request.get_json() or {}
        if "title" in data:
            item.title = data["title"]
        if "is_done" in data:
            item.is_done = bool(data["is_done"])

        db.session.commit()
        return item.to_dict(), 200

    @jwt_required()
    def delete(self, item_id):
        user_id = int(get_jwt_identity())
        item = Item.query.filter_by(id=item_id, user_id=user_id).first()
        if not item:
            return {"error": "not found"}, 404

        db.session.delete(item)
        db.session.commit()
        return {}, 204


api.add_resource(ItemListResource, "/items")
api.add_resource(ItemResource, "/items/<int:item_id>")