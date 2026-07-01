import { Request, Response } from 'express';
import { getProducts, getProductById } from '../services/product.service';

export const getProductsController = async (req: Request, res: Response) => {
  try {
    const { category, carModel } = req.query;
    const products = await getProducts({ 
      category: category as string, 
      carModel: carModel as string,
    });
    res.json({ products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProductByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);
    
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    res.json({ product });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};